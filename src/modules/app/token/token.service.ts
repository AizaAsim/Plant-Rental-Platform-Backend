import { Injectable } from '@nestjs/common';
import DatabaseService from '../../../database/database.service';
import CreatePasswordTokenRequestDTO from './dto/request/create.request';

@Injectable()
export default class TokenService {
    constructor(private _dbService: DatabaseService) {}

    async CreatePasswordToken(data: CreatePasswordTokenRequestDTO) {
        // Token model doesn't exist in schema - using OTP model instead
        // This service may need to be refactored to use OTP verification
        throw new Error('Token service needs to be refactored to use OTP verification');
    }

    async GetToken(code: string, reason?: string) {
        // Token model doesn't exist in schema - using OTP model instead
        // This service may need to be refactored to use OTP verification
        throw new Error('Token service needs to be refactored to use OTP verification');
    }
}
