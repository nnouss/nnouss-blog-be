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
        parentId?: string,
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
                return { ...created, depth: Number(created.depth) };
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

            // depth 계산 (Prisma depth는 BigInt이므로 number로 변환 후 연산)
            const computedDepth = Number(parent.depth ?? 0) + 1;

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
            return { ...created, depth: Number(created.depth) };
        });
    }
}
