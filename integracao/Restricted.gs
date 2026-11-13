/** Área restrita LSP 133. Adicionar ao MESMO projeto do Código.gs.
 * Senha somente nas Propriedades do script; nunca neste arquivo.
 * Implantação: executar como usuário acessando; acesso restrito ao domínio.
 */
function restrictedIdentity_() {
  assertAuthorized_();
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) throw new Error('Entre com sua conta corporativa.');
  return email;
}
function restrictedHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function restrictedEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  let different = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length,b.length); i++) different |= (a.charCodeAt(i)||0) ^ (b.charCodeAt(i)||0);
  return different === 0;
}
/** Executar no editor após definir RESTRICTED_PASSWORD nas Propriedades.
 * O sufixo _ impede chamada desta função por google.script.run.
 */
function configurarSenhaRestrita_() {
  restrictedIdentity_();
  const props = PropertiesService.getScriptProperties();
  const password = props.getProperty('RESTRICTED_PASSWORD');
  if (!password || password.length < 12 || password.length > 256) {
    throw new Error('Configure RESTRICTED_PASSWORD com 12 a 256 caracteres nas Propriedades do script.');
  }
  const salt = Utilities.getUuid() + Utilities.getUuid();
  props.setProperties({RESTRICTED_PASSWORD_SALT:salt,RESTRICTED_PASSWORD_HASH:restrictedHash_(salt + ':' + password)});
  props.deleteProperty('RESTRICTED_PASSWORD');
  console.log('Senha configurada. Sessões anteriores invalidadas. Nenhuma senha foi registrada no log.');
}
function restrictedConfig_() {
  const p = PropertiesService.getScriptProperties();
  const salt = p.getProperty('RESTRICTED_PASSWORD_SALT');
  const hash = p.getProperty('RESTRICTED_PASSWORD_HASH');
  if (!salt || !hash) throw new Error('A área restrita ainda não está disponível.');
  return {salt,hash};
}
function restrictedLogin(password) {
  const email = restrictedIdentity_();
  const config = restrictedConfig_();
  const cache = CacheService.getUserCache();
  const key = 'rp:attempts:' + restrictedHash_(email);
  const lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    const now = Date.now();
    const old = cache.get(key);
    let attempts = old ? JSON.parse(old) : {count:0,until:now + 900000};
    if (now >= attempts.until) attempts = {count:0,until:now + 900000};
    if (attempts.count >= 5) throw new Error('Limite de tentativas. Aguarde 15 minutos antes de tentar novamente.');
    const valid = typeof password === 'string' && password.length <= 256
      && restrictedEqual_(restrictedHash_(config.salt + ':' + password),config.hash);
    if (!valid) {
      attempts.count++;
      cache.put(key,JSON.stringify(attempts),Math.max(1,Math.ceil((attempts.until-now)/1000)));
      throw new Error('Senha incorreta.');
    }
    cache.remove(key);
    const token = Utilities.getUuid() + Utilities.getUuid();
    cache.put('rp:session:' + restrictedHash_(token),JSON.stringify({email,version:config.hash,expires:now+3600000}),3600);
    return {token,expiresAt:now+3600000};
  } finally { lock.releaseLock(); }
}
function restrictedRequireSession_(token) {
  const email = restrictedIdentity_();
  if (typeof token !== 'string' || token.length < 40 || token.length > 200) throw new Error('Acesso restrito: informe a senha.');
  const config = restrictedConfig_();
  const cached = CacheService.getUserCache().get('rp:session:' + restrictedHash_(token));
  if (!cached) throw new Error('Sua sessão expirou. Entre novamente.');
  const session = JSON.parse(cached);
  if (session.email !== email || session.expires <= Date.now() || !restrictedEqual_(session.version,config.hash)) {
    throw new Error('Sua sessão expirou. Entre novamente.');
  }
  return email;
}
function restrictedLogout(token) {
  restrictedIdentity_();
  if (typeof token === 'string' && token.length <= 200) CacheService.getUserCache().remove('rp:session:' + restrictedHash_(token));
  return true;
}
function restrictedDate_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v,'America/Sao_Paulo','yyyy-MM-dd');
  const m = String(v || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? m[3]+'-'+m[2]+'-'+m[1] : null;
}
function restrictedGetData(token, section, filters) {
  // Obrigatório antes de QUALQUER leitura ou retorno de indicadores.
  restrictedRequireSession_(token);
  if (!['insucessos','erros'].includes(section)) throw new Error('Área inválida.');
  const f = normalizeFilters_(filters || {});
  if (f.from && f.to && f.from > f.to) throw new Error('Período inválido.');
  const within = date => (!f.from || date >= f.from) && (!f.to || date <= f.to);
  const result = section === 'insucessos'
    ? lspCentralInsucessos_(f)
    : lspCentralErros_(f);
  result.section = section;
  result.updatedAt = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
  return result;
}
