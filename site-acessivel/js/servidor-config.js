/* Navi — endereço do servidor (Supabase) da Área ADM e dos avisos compartilhados.
   Vazio = o site funciona como antes: avisos só no aparelho e Área ADM desligada.
   Como preencher: supabase/LEIA-ME.md. A chave é a pública (publishable), nunca a secreta/service_role.
   Depois de mudar este arquivo, troque a VERSAO no começo do sw.js. */
self.NAVI_SERVIDOR = {
  url: 'https://uulohopghibbiealqyoc.supabase.co',
  chavePublica: 'sb_publishable_y7TIlGWY1ooiNnp5AzME9Q_RCqPp4iS'
};
