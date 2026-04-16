export const LOGIN_EVENT = 'login';
export const LOGIN_RESPONSE_EVENT = 'login-response';

export type LoginFailureReason = 'PLAYER_NOT_REGISTERED' | 'PASSWORD_MISMATCH' | 'UNKNOWN';

export interface LoginRequest {
	playerName: string;
	password: string;
}

export interface LoginResponse {
	success: boolean;
	message: string;
	reason?: LoginFailureReason;
	playerId?: string;
}
