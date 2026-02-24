import {
    Controller,
    Delete,
    Param,
    ParseIntPipe,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CommentService } from 'src/comment/comment.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('comment')
export class CommentController {
    constructor(private readonly commentService: CommentService) {}

    /** 댓글 삭제 (leaf: hard delete, 자식 있으면 soft delete) */
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async delete(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
        const userId = req.user!.sub;
        await this.commentService.delete(id, userId);
        return { success: true };
    }
}
