import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PostType } from 'src/generated/prisma/enums';

@Injectable()
export class TagService {
    constructor(private readonly prismaService: PrismaService) {}

    /** 게시판 타입별 태그 불러오기 */
    async getTags(type?: PostType) {
        const baseSelect = {
            name: true,
            _count: {
                select: {
                    posts: true,
                },
            },
        } as const;

        if (!type) {
            return this.prismaService.tag.findMany({
                orderBy: { createdAt: 'asc' },
                select: baseSelect,
            });
        }

        return this.prismaService.tag.findMany({
            where: {
                posts: {
                    some: {
                        post: {
                            type,
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
            select: {
                name: true,
                _count: {
                    select: {
                        posts: {
                            where: {
                                post: { type },
                            },
                        },
                    },
                },
            },
        });
    }
}
