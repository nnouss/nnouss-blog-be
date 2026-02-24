import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CommentService {
    constructor(private readonly prismaService: PrismaService) {}

    /** 댓글 작성 */
    async createComment(
        postId: string,
        authorId: string,
        content: string,
        parentId?: number,
    ) {
        if (!authorId) throw new ForbiddenException('로그인이 필요합니다.');

        if (!content?.trim())
            throw new BadRequestException('댓글 내용을 입력해주세요.');

        return this.prismaService.$transaction(async (tx) => {
            const post = await tx.post.findUnique({
                where: { id: postId },
                select: { id: true },
            });

            if (!post)
                throw new NotFoundException('게시글을 찾을 수 없습니다.');

            // 1) 최상위 댓글
            if (!parentId) {
                const created = await tx.comment.create({
                    data: {
                        postId,
                        authorId,
                        content,
                        parentId: null,
                        rootId: null,
                        depth: 0,
                        replyToUserId: null,
                    },
                });
                return created;
            }

            // 2) 답글(대댓글/대댓글의 대댓글...)
            const parent = await tx.comment.findUnique({
                where: { id: parentId },
                select: {
                    id: true,
                    postId: true,
                    authorId: true,
                    parentId: true,
                    rootId: true,
                    depth: true,
                    isDeleted: true,
                },
            });

            if (!parent)
                throw new NotFoundException('부모 댓글을 찾을 수 없습니다.');

            if (parent.postId !== postId)
                throw new BadRequestException('잘못된 댓글 참조입니다.');

            const isReplyToTopLevel = parent.parentId === null; // parent가 최상위면 true

            /**
             * rootId 계산:
             *  - parent가 최상위면 rootId는 parent.id
             *  - parent가 이미 thread 안이면 parent.rootId
             */
            const computedRootId = parent.rootId ?? parent.id;

            // depth 계산
            const computedDepth = (parent.depth ?? 0) + 1;

            /**
             * replyToUserId:
             *  - 대댓글은 앞에 parent 작성자를 @ 표시 태그
             */
            const computedReplyToUserId = parent.authorId;

            const created = await tx.comment.create({
                data: {
                    postId,
                    authorId,
                    content,
                    parentId: parent.id,
                    rootId: computedRootId,
                    depth: computedDepth,
                    replyToUserId: computedReplyToUserId,
                },
            });
            return created;
        });
    }

    /** 댓글 목록 조회 (page 기반 페이지네이션, limit 고정 5) */
    async getByPostId(
        postId: string,
        page: number = 1,
    ): Promise<{
        data: any[];
        totalCount: number;
        totalPages: number;
        currentPage: number;
    }> {
        const limit = 5;
        const skip = (page - 1) * limit;

        const post = await this.prismaService.post.findUnique({
            where: { id: postId },
            select: { id: true },
        });

        if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');

        const [totalCount, rootCount, roots] = await Promise.all([
            // 전체 댓글 수
            this.prismaService.comment.count({ where: { postId } }),

            // 전체 root 댓글 수
            this.prismaService.comment.count({
                where: { postId, parentId: null },
            }),

            // root 댓글
            this.prismaService.comment.findMany({
                where: { postId, parentId: null },
                orderBy: { createdAt: 'asc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    content: true,
                    depth: true,
                    parentId: true,
                    rootId: true,
                    authorId: true,
                    replyToUserId: true,
                    isDeleted: true,
                    deletedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                        select: { id: true, nickname: true },
                    },
                    replyToUser: {
                        select: { id: true, nickname: true },
                    },
                },
            }),
        ]);

        // root 댓글 Id 배열
        const rootIds = roots.map((r) => r.id);

        const allComments =
            rootIds.length === 0
                ? []
                : await this.prismaService.comment.findMany({
                      where: {
                          postId,
                          OR: [
                              { id: { in: rootIds } },
                              { rootId: { in: rootIds } },
                          ],
                      },
                      orderBy: [{ rootId: 'asc' }, { createdAt: 'asc' }],
                      select: {
                          id: true,
                          content: true,
                          depth: true,
                          parentId: true,
                          rootId: true,
                          authorId: true,
                          replyToUserId: true,
                          isDeleted: true,
                          deletedAt: true,
                          createdAt: true,
                          updatedAt: true,
                          author: {
                              select: { id: true, nickname: true },
                          },
                          replyToUser: {
                              select: { id: true, nickname: true },
                          },
                      },
                  });

        const data = roots.map((root) => {
            // 해당 root 댓글과 하위 댓글
            const thread = allComments.filter(
                (c) => c.rootId === root.id && c.id !== root.id,
            );

            return {
                ...root,
                thread,
            };
        });

        const totalPages = Math.ceil(rootCount / limit) || 1;

        return {
            data,
            totalCount,
            totalPages,
            currentPage: page,
        };
    }

    /** 댓글 삭제: leaf면 hard delete, 자식 있으면 soft delete */
    async delete(commentId: number, userId: string): Promise<void> {
        const comment = await this.prismaService.comment.findUnique({
            where: { id: commentId },
            select: {
                authorId: true,
                isDeleted: true,
                _count: { select: { children: true } },
            },
        });

        if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다.');

        if (comment.authorId !== userId)
            throw new ForbiddenException('댓글을 삭제할 권한이 없습니다.');

        if (comment.isDeleted)
            throw new BadRequestException('이미 삭제된 댓글입니다.');

        if (comment._count.children === 0) {
            await this.prismaService.comment.delete({
                where: { id: commentId },
            });
        } else {
            await this.prismaService.comment.update({
                where: { id: commentId },
                data: { isDeleted: true, deletedAt: new Date() },
            });
        }
    }
}
