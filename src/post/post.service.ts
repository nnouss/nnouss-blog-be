import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePostDto } from './dtos/create-post.dto';
import { generateSlug } from 'src/utils/slug-utils';
import { EditPostDto } from './dtos/edit-post.dto';

@Injectable()
export class PostService {
    constructor(private readonly prismaService: PrismaService) {}

    /** 글 등록 */
    async createPost(
        { title, content, tags, thumbnailUrl }: CreatePostDto,
        authorId: string,
    ): Promise<void> {
        // 1. slug 생성
        const slug = await generateSlug(title);

        // 2. Prisma 트랜잭션으로 게시글 및 태그 생성
        await this.prismaService.$transaction(async (tx) => {
            // 2-1. Post 생성
            const post = await tx.post.create({
                data: {
                    authorId,
                    title,
                    content,
                    thumbnail: thumbnailUrl || null,
                    slug,
                },
            });

            // 2-2. Tag 처리 (기존 태그 찾기 또는 새로 생성)
            const tagIds = await Promise.all(
                tags.map(async (tagName) => {
                    const tag = await tx.tag.upsert({
                        where: { name: tagName },
                        update: {},
                        create: { name: tagName },
                    });

                    return tag.id;
                }),
            );

            // 2-3. PostTag 연결 생성
            await tx.postTag.createMany({
                data: tagIds.map((tagId) => ({
                    postId: post.id,
                    tagId,
                })),
            });
        });
    }

    /** 사이트맵용 글 전체 리스트 가져오기 */
    async getAllPosts() {
        const posts = await this.prismaService.post.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                slug: true,
                createdAt: true,
            },
        });

        return posts;
    }

    /** 글 리스트 가져오기 */
    async getPosts(page: number, tag?: string) {
        const limit = 5;
        const skip = (page - 1) * limit;

        // 조건
        const where = tag
            ? {
                  tags: {
                      some: {
                          tag: {
                              name: tag,
                          },
                      },
                  },
              }
            : {};

        const posts = await this.prismaService.post.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                id: true,
                title: true,
                thumbnail: true,
                slug: true,
                views: true,
                createdAt: true,
                author: {
                    select: {
                        id: true,
                        nickname: true,
                    },
                },
                tags: {
                    select: {
                        tag: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        Comments: true,
                    },
                },
            },
        });

        return posts.map((post) => ({
            ...post,
            tags: post.tags.map((postTag) => postTag.tag.name),
            commentCount: post._count.Comments,
        }));
    }

    /** 글 상세 가져오기 */
    async getPost(slug: string) {
        const post = await this.prismaService.post.findUnique({
            where: { slug },
            select: {
                id: true,
                title: true,
                content: true,
                thumbnail: true,
                slug: true,
                views: true,
                createdAt: true,
                updatedAt: true,
                author: {
                    select: {
                        id: true,
                        nickname: true,
                    },
                },
                tags: {
                    select: {
                        tag: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        if (!post) {
            throw new NotFoundException('게시글을 찾을 수 없습니다.');
        }

        // 조회수 증가 (게시글이 존재할 때만)
        await this.updateViews(post.id);

        return {
            ...post,
            tags: post.tags.map((postTag) => postTag.tag.name),
        };
    }

    /** 글 조회수 증가 */
    async updateViews(id: string) {
        return await this.prismaService.post.update({
            where: { id },
            data: {
                views: {
                    increment: 1,
                },
            },
        });
    }

    /** 글 삭제 */
    async deletePost(id: string, authorId: string) {
        // 1. 게시글 찾기 (태그 정보 포함)
        const post = await this.prismaService.post.findUnique({
            where: { id },
            select: {
                id: true,
                authorId: true,
                tags: {
                    select: {
                        tagId: true,
                    },
                },
            },
        });

        // 2. 게시글이 없으면 오류
        if (!post) {
            throw new NotFoundException('게시글을 찾을 수 없습니다.');
        }

        // 3. 작성자 확인
        if (post.authorId !== authorId) {
            throw new ForbiddenException('게시글을 삭제할 권한이 없습니다.');
        }

        // 4. 트랜잭션으로 게시글 삭제 및 사용되지 않는 태그 정리
        await this.prismaService.$transaction(async (tx) => {
            // 4-1. 게시글 삭제 (Cascade로 PostTag도 자동 삭제됨)
            await tx.post.delete({
                where: { id },
            });

            // 4-2. 사용되지 않는 태그 일괄 삭제 (PostTag 연결이 없는 태그만)
            const tagIds = post.tags.map((postTag) => postTag.tagId);

            if (tagIds.length > 0) {
                await tx.tag.deleteMany({
                    where: {
                        id: { in: tagIds },
                        posts: { none: {} },
                    },
                });
            }
        });
    }

    /** 글 수정 */
    async editPost(id: string, data: EditPostDto, authorId: string) {
        // 1. 게시글 찾기 (기존 태그 정보 포함)
        const post = await this.prismaService.post.findUnique({
            where: { id },
            select: {
                id: true,
                authorId: true,
                title: true,
                slug: true,
                tags: {
                    select: {
                        tagId: true,
                        tag: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        // 2. 게시글이 없으면 오류
        if (!post) {
            throw new NotFoundException('게시글을 찾을 수 없습니다.');
        }

        // 3. 작성자 확인
        if (post.authorId !== authorId) {
            throw new ForbiddenException('게시글을 수정할 권한이 없습니다.');
        }

        // 4. 트랜잭션으로 게시글 및 태그 수정
        await this.prismaService.$transaction(async (tx) => {
            // 4-1. 제목이 변경되었으면 slug 새로 생성
            let newSlug = post.slug;
            if (data.title && data.title !== post.title) {
                newSlug = await generateSlug(data.title);
            }

            // 4-2. 제목, content, 썸네일, 슬러그 수정저장
            const updateData: {
                title?: string;
                content?: string;
                thumbnail?: string | null;
                slug?: string;
            } = {};

            if (data.title !== undefined) {
                updateData.title = data.title;
            }
            if (data.content !== undefined) {
                updateData.content = data.content;
            }
            if (data.thumbnailUrl !== undefined) {
                updateData.thumbnail = data.thumbnailUrl || null;
            }
            if (newSlug !== post.slug) {
                updateData.slug = newSlug;
            }

            if (Object.keys(updateData).length > 0) {
                await tx.post.update({
                    where: { id: post.id },
                    data: updateData,
                });
            }

            // 4-3. 태그가 변경되었으면 기존 태그 삭제하고 새로 생성
            if (data.tags !== undefined) {
                // 기존 태그 이름 배열 (정렬)
                const existingTagNames = post.tags
                    .map((postTag) => postTag.tag.name)
                    .sort();
                // 새로운 태그 이름 배열 (정렬)
                const newTagNames = [...data.tags].sort();

                // 태그가 다르면 업데이트
                const tagsChanged =
                    existingTagNames.length !== newTagNames.length ||
                    existingTagNames.some(
                        (tag, index) => tag !== newTagNames[index],
                    );

                if (tagsChanged) {
                    // 기존 태그 ID 저장 (나중에 사용되지 않는 태그 삭제용)
                    const existingTagIds = post.tags.map(
                        (postTag) => postTag.tagId,
                    );

                    // 기존 PostTag 연결 삭제
                    await tx.postTag.deleteMany({
                        where: { postId: post.id },
                    });

                    // 새로운 태그 처리 (기존 태그 찾기 또는 새로 생성)
                    const newTagIds = await Promise.all(
                        data.tags.map(async (tagName) => {
                            const tag = await tx.tag.upsert({
                                where: { name: tagName },
                                update: {},
                                create: { name: tagName },
                            });

                            return tag.id;
                        }),
                    );

                    // 새로운 PostTag 연결 생성
                    if (newTagIds.length > 0) {
                        await tx.postTag.createMany({
                            data: newTagIds.map((tagId) => ({
                                postId: post.id,
                                tagId,
                            })),
                        });
                    }

                    // 사용되지 않는 태그 삭제 (PostTag 연결이 없는 태그만)
                    if (existingTagIds.length > 0) {
                        await tx.tag.deleteMany({
                            where: {
                                id: { in: existingTagIds },
                                posts: { none: {} },
                            },
                        });
                    }
                }
            }
        });
    }
}
