// Navi — cadastra um novo ADM (RN67). Só quem já é ADM pode chamar.
// Publicar com: supabase functions deploy criar-adm
// Corpo: { usuario, senha }. Respostas: 201 {usuario}, 400 {erro}, 401, 403, 409 {erro:'existe'}.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const USUARIO = /^[a-z0-9.-]{3,30}$/;

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta(405, { erro: 'metodo' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1. Quem chama está logado?
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return resposta(401, { erro: 'sessao' });
  const { data: quem, error: erroQuem } = await admin.auth.getUser(token);
  if (erroQuem || !quem?.user) return resposta(401, { erro: 'sessao' });

  // 2. E é ADM?
  const { data: eu } = await admin.from('adms').select('usuario').eq('id', quem.user.id).maybeSingle();
  if (!eu) return resposta(403, { erro: 'nao-adm' });

  // 3. O pedido é válido?
  let corpo: { usuario?: unknown; senha?: unknown };
  try { corpo = await req.json(); } catch { return resposta(400, { erro: 'invalido' }); }
  const usuario = typeof corpo.usuario === 'string' ? corpo.usuario.trim().toLowerCase() : '';
  const senha = typeof corpo.senha === 'string' ? corpo.senha : '';
  if (!USUARIO.test(usuario) || senha.length < 8) return resposta(400, { erro: 'invalido' });

  // 4. Cria a conta (já confirmada) e o registro de ADM.
  const { data: novo, error: erroNovo } = await admin.auth.admin.createUser({
    email: `${usuario}@adm.navi`,
    password: senha,
    email_confirm: true,
  });
  if (erroNovo || !novo?.user) {
    const msg = (erroNovo?.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return resposta(409, { erro: 'existe' });
    }
    return resposta(500, { erro: 'servidor' });
  }

  const { error: erroAdm } = await admin.from('adms').insert({
    id: novo.user.id,
    usuario,
    criado_por: eu.usuario,
  });
  if (erroAdm) {
    await admin.auth.admin.deleteUser(novo.user.id); // não deixa conta sem registro de ADM
    if (erroAdm.code === '23505') return resposta(409, { erro: 'existe' });
    return resposta(500, { erro: 'servidor' });
  }

  return resposta(201, { usuario });
});
