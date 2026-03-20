import { IsEnum, IsOptional } from 'class-validator';
import { PostType } from 'src/post/dtos/create-post.dto';

export class GetTagsQueryDto {
    @IsOptional()
    @IsEnum(PostType)
    type?: PostType;
}
