import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';
import { PostType } from './create-post.dto';

export class EditPostDto {
    @IsString()
    @IsOptional()
    @IsNotEmpty()
    title?: string;

    @IsEnum(PostType)
    @IsOptional()
    type?: PostType;

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    tags?: string[];

    @IsString()
    @IsOptional()
    @IsNotEmpty()
    content?: string;

    @IsString()
    @IsOptional()
    thumbnailUrl?: string | null;
}
