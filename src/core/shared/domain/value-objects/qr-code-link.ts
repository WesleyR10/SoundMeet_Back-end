/**
 * O conteúdo do QR code impresso — e por que ele é uma URL https.
 *
 * ## O problema que isto resolve
 *
 * 🔴 Até 27/ago/2026 o QR gravava `soundmeet://musician/<uuid>`. Um esquema
 * customizado **não faz nada** na câmera nativa de quem não tem o app
 * instalado — e esse é exatamente o momento de aquisição nº 1 do produto: um
 * fã novo, num bar, apontando a câmera para o adesivo da mesa. O scan
 * simplesmente falhava, em silêncio.
 *
 * Uma URL https resolve os dois casos com o MESMO código impresso: com o app
 * instalado e os App Links/Universal Links verificados, o SO abre o app
 * direto; sem o app, abre a página pública, que oferece a instalação.
 *
 * ## Por que a rota canônica, e não um atalho `/m/<uuid>`
 *
 * A página SSR já existe em `/musico/<uuid>` (W5). Um atalho economizaria ~4
 * caracteres no QR — irrelevante para a densidade — ao custo de um redirect,
 * e **redirect quebra Universal Link no iOS**: o SO não segue o 3xx, ele
 * desiste e entrega ao navegador.
 *
 * ## O host: `soundmeet.com.br`
 *
 * 🔴 É o domínio que a plataforma REGISTROU (Hostinger, 29/ago/2026).
 * `soundmeet.app` esteve aqui até 07/set/2026 por engano: ele é de TERCEIRO
 * (responde 308 para `www` e serve uma SPA Vite em inglês). Gravar host
 * alheio no QR impresso é entregar o momento de aquisição nº 1 do produto a
 * quem controla aquele domínio.
 *
 * Apex sem `www` de propósito: `www.soundmeet.com.br` redirecionaria, e
 * redirect quebra Universal Link no iOS e a busca de `assetlinks.json` no
 * Android — o SO não segue 3xx em nenhuma das duas.
 */
export const QR_DEFAULT_BASE_URL = "https://soundmeet.com.br";

export const QR_MUSICIAN_PATH = "musico";
export const QR_ESTABLISHMENT_PATH = "local";

export function buildMusicianQrLink(
  musicianId: string,
  baseUrl: string = QR_DEFAULT_BASE_URL,
): string {
  return `${trimTrailingSlash(baseUrl)}/${QR_MUSICIAN_PATH}/${musicianId}`;
}

export function buildEstablishmentQrLink(
  establishmentId: string,
  baseUrl: string = QR_DEFAULT_BASE_URL,
): string {
  return `${trimTrailingSlash(baseUrl)}/${QR_ESTABLISHMENT_PATH}/${establishmentId}`;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
