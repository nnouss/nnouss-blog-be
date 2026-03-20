import { Controller, Get, Query } from '@nestjs/common';
import { TagService } from './tag.service';
import { GetTagsQueryDto } from './dtos/get-tags-query.dto';

@Controller('tag')
export class TagController {
    constructor(private readonly tagService: TagService) {}

    /** 게시판 타입별 태그 불러오기 */
    @Get('')
    async getTags(@Query() query: GetTagsQueryDto) {
        return this.tagService.getTags(query.type);
    }
}
