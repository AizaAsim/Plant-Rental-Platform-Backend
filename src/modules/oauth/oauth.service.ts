import { Injectable } from '@nestjs/common';
import { BadRequestException } from '../../core/exceptions/response.exception';
import { IOAuthTokenData, OAuthProviders } from '../../core/interfaces';
import AppleOAuthService from './providers/apple.service';
import GoogleOAuthService from './providers/google.service';

@Injectable()
export default class OAuthService {
    constructor(
        private _googleService: GoogleOAuthService,
        private _appleService: AppleOAuthService,
    ) {}

    async GetTokenData(token: string, type: OAuthProviders): Promise<IOAuthTokenData> {
        try {
            switch (type) {
                case 'google':
                    return await this._googleService.GetTokenData(token);
                case 'apple':
                    return await this._appleService.GetTokenData(token);
                default:
                    throw new BadRequestException('Invalid OAuth provider');
            }
        } catch (err) {
            console.log("ERROR", err)
            throw new BadRequestException('Invalid OAuth token');
        }
    }
}
