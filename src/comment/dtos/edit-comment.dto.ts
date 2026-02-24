import { IsNotEmpty, IsString } from 'class-validator';

export class EditCommentDto {
    @IsString()
    @IsNotEmpty()
    content!: string;
}
