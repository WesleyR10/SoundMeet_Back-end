/**
 * Porta para confirmar que um item da MusicLibrary pertence ao músico que está
 * operando. O `music_library_id` chega no corpo da requisição e vira o destino
 * da cifra materializada no fim do pipeline — sem esta checagem um músico
 * autenticado gravaria resultado de análise dentro do catálogo de outro.
 *
 * Fica como porta (e não import direto do use case de music-library) para o
 * ai-cifra não depender de outro domínio na camada de aplicação.
 */
export interface IMusicLibraryOwnershipChecker {
  isOwnedBy(musicLibraryId: string, musicianId: string): Promise<boolean>;
}
