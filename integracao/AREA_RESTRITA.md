# Área restrita: Insucessos e Erros de Expedição

Status: os arquivos estão preparados, mas a senha só passa a ser exigida após instalar e republicar a versão do Google Apps Script. Atualizar arquivos no GitHub não instala código no Google.

## Antes de começar: impedir novas exportações públicas

Instale primeiro a versão atual de `integracao/AppsScript_Sync_LSP133.gs` no arquivo `Sync_GitHub.gs` do Google, salve e execute `syncLsp133ToGitHub`. Isso impede que o gatilho antigo volte a enviar os indicadores restritos ao JSON público. Não precisa alterar o gatilho. Depois continue com a área autenticada abaixo.

## 1. Adicionar os dois arquivos

No projeto Apps Script atual, adicione:

- Script `Restricted`: conteúdo de `integracao/Restricted.gs`.
- HTML `Restricted`: conteúdo de `integracao/Restricted.html`.

Não substitua os módulos de Produção ou Expedição.

## 2. Atualizar a função doGet no Código.gs

Substitua somente a função `doGet` existente por:

```javascript
function doGet(e) {
  assertAuthorized_();
  const area = e && e.parameter ? e.parameter.area : '';
  const file = ['insucessos', 'erros'].includes(area) ? 'Restricted' : 'Index';
  return HtmlService.createHtmlOutputFromFile(file)
    .setTitle('LSP 133 | Central Operacional')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
```

## 3. Proteger também a API antiga

No Código.gs, troque o início da função `getDashboardData` para:

```javascript
function getDashboardData(filters, restrictedSession) {
  assertAuthorized_();
  restrictedRequireSession_(restrictedSession);
  // Continue aqui com todo o restante da função que já existe.
```

Não substitua o restante da função pelo comentário. A verificação deve ficar ANTES do cache e das leituras. Sem esse passo, a API antiga ainda permite consultar informações sem a senha.

O teste antigo `testarConexao` passa a exigir acesso restrito por chamar essa API. Para verificar o novo fluxo, use a página protegida e os testes de acesso do passo 8.

## 4. Direcionar também os botões do aplicativo Google

No `Index.html` original do Google, localize `function changeTab(next){`. Insira este trecho logo após a abertura `{`, antes de `tab=next`:

```javascript
if (next === 'ins' || next === 'eti') {
  const area = next === 'ins' ? 'insucessos' : 'erros';
  const url = 'https://script.google.com/a/macros/shopeemobile-external.com/s/AKfycbyj5tAJaVY8V2A5qYyE47lNpnta_AwTII8iHdcfMnQmb-AkxJxUVHcDx-xCrK7-k2uCgA/exec';
  window.open(url + '?area=' + area, '_blank', 'noopener,noreferrer');
  return;
}
```

Mantenha o restante de `changeTab`. Produção e Expedição continuam usando a interface original.

## 5. Configurar a senha e as fontes

Em Configurações do projeto → Propriedades do script:

- Confirme `INSUCESSOS_SPREADSHEET_ID` e `ERROS_SPREADSHEET_ID`, já utilizados no sincronizador anterior.
- Adicione `RESTRICTED_PASSWORD` com uma senha compartilhada forte de 12 a 256 caracteres. Não coloque a senha em código, GitHub, links ou nesta documentação.

Salve os arquivos e execute `configurarSenhaRestrita_` uma vez no editor. Essa função substitui a senha temporária por hash com salt e apaga a propriedade `RESTRICTED_PASSWORD`. Não remova `RESTRICTED_PASSWORD_HASH` nem `RESTRICTED_PASSWORD_SALT`.

Para trocar a senha, adicione novamente `RESTRICTED_PASSWORD` e execute a mesma função. A troca invalida as sessões anteriores. A sessão dura até uma hora e não é salva no armazenamento do navegador; sair, recarregar ou expirar pode exigir nova entrada. Depois de cinco tentativas erradas por usuário, a tentativa de login é bloqueada por 15 minutos, utilizando o cache do Apps Script.

## 6. Atualizar a implantação existente

Implantar → Gerenciar implantações → editar a implantação atual → Nova versão → Implantar.

Mantenha execução como **usuário acessando** e acesso restrito ao **domínio corporativo**. Não use acesso anônimo nem execute como proprietário. Os usuários também precisam das permissões Google necessárias para ler as fontes.

Atualize a mesma implantação para preservar o endereço. Implantações antigas não atualizadas mantêm o comportamento anterior e devem ser atualizadas ou arquivadas pelo responsável.

## 7. Instalar o sincronizador sem dados restritos

Substitua todo o conteúdo de `Sync_GitHub.gs` pelo arquivo `integracao/AppsScript_Sync_LSP133.gs` atualizado. Salve e execute `syncLsp133ToGitHub`.

Essa versão publica somente Produção e Expedição; não lê nem envia Insucessos ou Erros ao JSON público. Não precisa recriar o gatilho existente.

IMPORTANTE: se o script antigo continuar instalado, ele pode voltar a publicar os dados dessas áreas. A retirada do JSON atual e o bloqueio visual no GitHub, sozinhos, não concluem a proteção. Versões antigas do repositório, cópias e caches públicos não são apagados por essa instalação.

## 8. Conferir antes de considerar ativado

Abra o endereço atual terminado em `/exec?area=insucessos` e depois `/exec?area=erros`.

- Sem senha ou com senha errada: nenhum indicador deve ser retornado.
- Com a senha correta e conta corporativa: os indicadores aparecem.
- Após Sair: os indicadores desaparecem e a sessão é invalidada.
- Uma chamada da API antiga `getDashboardData({})`, sem sessão, deve falhar.
- O JSON público novo não deve conter os campos `insucessos` ou `erros`.

Os cards de Insucessos continuam globais da fonte; o filtro de datas atua no gráfico e tabela. Erros mantém a contagem por BR único por data e tipo. Nenhuma senha é enviada ao GitHub.

## VOANDO por dia

A área restrita de Insucessos inclui gráfico e tabela de VOANDO por dia, filtrados pelo período escolhido. A data vem do texto exibido em Informações (coluna F), o BR da coluna G e o status VOANDO da coluna I. A leitura percorre todas as linhas existentes e não usa a tabela intermediária com datas invertidas. A contagem é de registros com BR preenchido, preservando ocorrências da fonte; não deduplica BRs.

Registros VOANDO sem data ficam sinalizados separadamente e não recebem uma data inventada. Os cards globais permanecem separados do total do período. Para instalar esta atualização, substitua os dois arquivos Restricted.gs e Restricted.html e publique uma nova versão da implantação existente. Não é necessário trocar a senha nem recriar gatilhos.
