import { IMusicLibraryOwnershipChecker } from "../../application/ports/music-library-ownership.interface";

type MusicLibraryReader = {
  execute(input: { id: string }): Promise<{ musician_id: string }>;
};

/**
 * Adapter da porta de ownership sobre o use case de leitura da MusicLibrary.
 * Item inexistente conta como "não é seu": responder 404 aqui e 403 ali deixaria
 * enumerar ids de catálogo alheio pela diferença de status.
 */
export class MusicLibraryOwnershipChecker implements IMusicLibraryOwnershipChecker {
  constructor(private readonly getMusicLibrary: MusicLibraryReader) {}

  async isOwnedBy(
    musicLibraryId: string,
    musicianId: string,
  ): Promise<boolean> {
    try {
      const item = await this.getMusicLibrary.execute({ id: musicLibraryId });
      return item.musician_id === musicianId;
    } catch {
      return false;
    }
  }
}
