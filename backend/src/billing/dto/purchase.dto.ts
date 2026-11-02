import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class VerifyPurchaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  productId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  purchaseToken: string;
}

export class RestorePurchaseItemDto extends VerifyPurchaseDto {}

export class RestorePurchasesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RestorePurchaseItemDto)
  purchases: RestorePurchaseItemDto[];
}
