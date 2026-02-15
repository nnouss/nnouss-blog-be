import {
    Body,
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
import { PostService } from './post.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreatePostDto } from './dtos/create-post.dto';
import { Request } from 'express';
import { EditPostDto } from './dtos/edit-post.dto';

@Controller('post')
export class PostController {
    constructor(private readonly postService: PostService) {}

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

    /** 글 리스트 가져오기 */
    @Get('')
    async getPosts(
        @Query('page', ParseIntPipe) page: number,
        @Query('tag') tag?: string,
    ) {
        return await this.postService.getPosts(page, tag);
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
}
