import { Module } from '@nestjs/common';
import { PostController } from 'src/post/post.controller';
import { PostService } from 'src/post/post.service';
import { CommentModule } from 'src/comment/comment.module';

@Module({
    imports: [CommentModule],
    controllers: [PostController],
    providers: [PostService],
})
export class PostModule {}
