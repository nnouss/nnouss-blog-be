import {
    Body,
    BadRequestException,
    Controller,
    Get,
    Post,
    Query,
    Req,
    UseGuards,
    ParseIntPipe,
    Param,
    Delete,
    Put,
} from '@nestjs/common';
import { Request } from 'express';
import { PostService } from './post.service';
import { CommentService } from 'src/comment/comment.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreatePostDto } from './dtos/create-post.dto';
import { EditPostDto } from './dtos/edit-post.dto';
import { CreateCommentDto } from 'src/comment/dtos/create-comment.dto';

@Controller('post')
export class PostController {
    constructor(
        private readonly postService: PostService,
        private readonly commentService: CommentService,
    ) {}

    /** 글 등록 */
    @UseGuards(JwtAuthGuard)
    @Post('')
    async createPost(@Body() data: CreatePostDto, @Req() req: Request) {
        const authorId = req.user.sub;

        await this.postService.createPost(data, authorId);

        return { success: true };
    }

    /** 사이트맵용 글 전체 리스트 가져오기 */
    @Get('all')
    async getAllPosts() {
        return await this.postService.getAllPosts();
    }

    /** 글 리스트 가져오기 (type: dev | story) */
    @Get('')
    async getPosts(
        @Query('page', ParseIntPipe) page: number,
        @Query('tag') tag?: string,
        @Query('type') type?: 'dev' | 'story',
    ) {
        return await this.postService.getPosts(page, tag, type);
    }

    /** 메인 슬라이드용 최신 글 5개 (type: dev | story) */
    @Get('latest')
    async getLatestPosts(@Query('type') type?: 'dev' | 'story') {
        if (type !== 'dev' && type !== 'story') {
            throw new BadRequestException('type must be dev or story');
        }

        return await this.postService.getLatestPosts(type);
    }

    /** 글 상세 가져오기 */
    @Get(':slug')
    async getPost(@Param('slug') slug: string) {
        return await this.postService.getPost(slug);
    }

    /** 글 삭제 */
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async deletePost(@Param('id') id: string, @Req() req: Request) {
        const authorId = req.user.sub;

        await this.postService.deletePost(id, authorId);

        return { success: true };
    }

    /** 글 수정 */
    @UseGuards(JwtAuthGuard)
    @Put(':id')
    async editPost(
        @Param('id') id: string,
        @Body() data: EditPostDto,
        @Req() req: Request,
    ) {
        const authorId = req.user.sub;

        await this.postService.editPost(id, data, authorId);

        return { success: true };
    }

    /** 댓글 작성 */
    @UseGuards(JwtAuthGuard)
    @Post(':postId/comment')
    async createComment(
        @Param('postId') postId: string,
        @Body() dto: CreateCommentDto,
        @Req() req: Request,
    ) {
        const authorId = req.user!.sub;
        return this.commentService.createComment(
            postId,
            authorId,
            dto.content,
            dto.parentId,
        );
    }

    /** 댓글 목록 조회 (비로그인 가능, page 기반 페이지네이션) */
    @Get(':postId/comments')
    async getComments(
        @Param('postId') postId: string,
        @Query('page') page?: string,
    ) {
        const pageNum = page ? Math.max(1, parseInt(page, 10) || 1) : 1;
        return this.commentService.getByPostId(postId, pageNum);
    }
}
