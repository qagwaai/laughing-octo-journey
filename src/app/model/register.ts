export const REGISTER_EVENT = 'register';
export const REGISTER_RESPONSE_EVENT = 'register-response';

export interface RegisterRequest {
	playerName: string;
	email: string;
	password: string;
}

export interface RegisterResponse {
	success: boolean;
	message: string;
	playerId?: string;
	sessionKey?: string;
}
