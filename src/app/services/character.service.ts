import { Injectable, inject } from '@angular/core';
import {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT,
  type CharacterAddRequest,
  type CharacterAddResponse,
} from '../model/character-add';
import {
  CHARACTER_EDIT_REQUEST_EVENT,
  CHARACTER_EDIT_RESPONSE_EVENT,
  type CharacterEditRequest,
  type CharacterEditResponse,
} from '../model/character-edit';
import {
  CHARACTER_DELETE_REQUEST_EVENT,
  CHARACTER_DELETE_RESPONSE_EVENT,
  type CharacterDeleteRequest,
  type CharacterDeleteResponse,
} from '../model/character-delete';
import {
  CHARACTER_LIST_REQUEST_EVENT,
  CHARACTER_LIST_RESPONSE_EVENT,
  type CharacterListRequest,
  type CharacterListResponse,
} from '../model/character-list';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private socketService = inject(SocketService);

  addCharacter(
    request: CharacterAddRequest,
    onResponse: (response: CharacterAddResponse) => void,
  ): () => void {
    const unsubscribe = this.socketService.on(CHARACTER_ADD_RESPONSE_EVENT, (response: CharacterAddResponse) => {
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(CHARACTER_ADD_REQUEST_EVENT, request);
    return unsubscribe;
  }

  editCharacter(
    request: CharacterEditRequest,
    onResponse: (response: CharacterEditResponse) => void,
  ): () => void {
    const unsubscribe = this.socketService.on(CHARACTER_EDIT_RESPONSE_EVENT, (response: CharacterEditResponse) => {
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(CHARACTER_EDIT_REQUEST_EVENT, request);
    return unsubscribe;
  }

  listCharacters(
    request: CharacterListRequest,
    onResponse: (response: CharacterListResponse) => void,
  ): () => void {
    const unsubscribe = this.socketService.on(CHARACTER_LIST_RESPONSE_EVENT, (response: CharacterListResponse) => {
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(CHARACTER_LIST_REQUEST_EVENT, request);
    return unsubscribe;
  }

  deleteCharacter(
    request: CharacterDeleteRequest,
    onResponse: (response: CharacterDeleteResponse) => void,
  ): () => void {
    const unsubscribe = this.socketService.on(CHARACTER_DELETE_RESPONSE_EVENT, (response: CharacterDeleteResponse) => {
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(CHARACTER_DELETE_REQUEST_EVENT, request);
    return unsubscribe;
  }
}
