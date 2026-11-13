# Instalar a fonte central nas dashboards

Fonte: **Validação de Dados - Fonte Dashboard - Lucas**. O ID deve ficar nas Propriedades privadas do Apps Script, sem ser incluído no código público.

A planilha já existe e suas abas não são alteradas por esta instalação. O GitHub usa o JSON agregado gerado pelo Apps Script; ele não lê diretamente o Sheets no navegador. A área corporativa lê a central pelo servidor Apps Script.

## Abas que continuam sendo utilizadas

| Área | Abas da central |
| --- | --- |
| Produção | Folha 1, Base de Produção, Controle ATs Desmanchadas, ATs Preservadas |
| Histórico de Produção | Histórico Diário, Histórico Audit |
| Expedição | Atribuição de Entrega, Resumo de Expedição, Histórico de Expedição e Expedição Hoje |
| Insucessos | Fonte Insucessos |
| Erros de Expedição | Fonte Erros Expedição |

A migração não muda a janela de Expedição Hoje, o critério de produção, nem as importações SPX/Insucessos/Relatório de Erros. A coleta SPX e suas filas privadas existentes são um fluxo separado e não são migradas nesta alteração.

## 1. Preserve a versão atual

Guarde uma cópia dos arquivos atuais do Apps Script antes de editar. Use o mesmo projeto da dashboard; não crie outra aplicação web.

## 2. Adicione ou atualize os arquivos de leitura

- Crie o Script **Fonte_Dados_Central** com o conteúdo completo de [Fonte_Dados_Central.gs](Fonte_Dados_Central.gs).
- Substitua o conteúdo de **Sync_GitHub.gs** pelo conteúdo completo de [AppsScript_Sync_LSP133.gs](AppsScript_Sync_LSP133.gs). Se já houver um arquivo com o nome AppsScript_Sync_LSP133 no projeto Google, mantenha apenas uma definição de cada função; não duplique o sincronizador.
- Atualize **Restricted.gs** com [Restricted.gs](Restricted.gs). Se a área restrita ainda não foi instalada, siga também [AREA_RESTRITA.md](AREA_RESTRITA.md) para instalar Restricted.html e a configuração de acesso. Não execute a troca de senha se ela já funciona.
- Preserve os demais arquivos, inclusive os de importação, Index.html e os módulos de Expedição.

## 3. Ajuste somente estas referências no Código.gs atual

No objeto CONFIG, altere os quatro campos abaixo, preservando os demais campos:

```javascript
INSUCESSOS_ID: lspSourceCentralId_(),
INSUCESSOS_TAB: 'Fonte Insucessos',
ETIQUETAS_ID: lspSourceCentralId_(),
ETIQUETAS_TAB: 'Fonte Erros Expedição',
```

Troque a declaração existente de PRODUCTION_ID_ por:

```javascript
const PRODUCTION_ID_ = lspSourceCentralId_();
```

Na função readGrid_, troque a montagem do intervalo que termina com CONFIG.MAX_SOURCE_ROWS por:

```javascript
const a1 = tab + '!A:' + col;
```

Isso remove o limite silencioso de 10.000 linhas sem mudar a largura de cada fonte. O serviço avançado Sheets usado por essa função deve continuar habilitado.

Na chave de cache existente, troque apenas o prefixo `LSP133-v5-` por `LSP133-central-v1-`. Preserve todo o restante da chave.

Não substitua o Código.gs inteiro por uma versão antiga: isso poderia remover alterações recentes de autenticação, histórico ou expedição. Preserve a função doGet, a normalização de filtros e as verificações de acesso já instaladas. Os pontos acima correspondem ao Código.gs enviado nesta conversa. Se algum deles não existir na versão atual, envie o arquivo atualizado antes de adaptar outros módulos.

## 4. Valide e configure a referência única

Em Configurações do projeto → Propriedades do script, configure **SOURCE_SPREADSHEET_ID** com o ID da planilha central (o trecho do link entre `/d/` e `/edit`). Não use o ID da planilha de teste nem da fonte antiga.

Salve os arquivos e execute **testarFonteCentralDashboards**. O log deve mostrar as nove estruturas como OK, sem listar dados de pessoas, BRs ou ATs.

Execute **configurarFonteCentralDashboards** uma vez. Ela configura SOURCE_SPREADSHEET_ID, INSUCESSOS_SPREADSHEET_ID e ERROS_SPREADSHEET_ID com o ID da central. Não muda GITHUB_TOKEN, PUBLICATION_APPROVED, senha ou gatilhos. A função não publica dados.

## 5. Atualize a implantação Google

Implantar → Gerenciar implantações → editar a implantação atual → Nova versão → Implantar. Atualize a mesma implantação para preservar os links das páginas.

Mantenha as configurações de acesso e execução da área corporativa que já foram definidas. Esta migração não é uma instalação de acesso público.

## 6. Atualize o JSON do GitHub

Execute **syncLsp133ToGitHub** no editor. A função continua exigindo GITHUB_TOKEN e PUBLICATION_APPROVED=YES e executa as validações atuais da produção antes de publicar. Se uma validação falhar, envie a mensagem; não desative a validação para forçar uma publicação.

O gatilho existente de syncLsp133ToGitHub continuará chamando o código novo. Não precisa recriá-lo. O workflow do Pages publica a atualização após o commit gerado pela sincronização.

## Conferência final

- Produção e histórico: conferir os totais contra as abas da central no mesmo período.
- Expedição: conferir por AT única; N é a data operacional, V a atribuição e U a conclusão. O sincronizador preserva o critério de considerar as ATs elegíveis da produção.
- Insucessos: conferir cards globais e séries filtradas na área corporativa. Cards são calculados na central, sem depender da antiga aba Dashboard, que não existe nesta fonte.
- Erros: a área restrita mantém a contagem de BR único por data e tipo e exclui ocorrências sem data dos totais por período. Não confundir com a quantidade bruta de linhas do painel antigo de etiquetagem.
- Insucessos/Erros continuam fora do JSON público. A migração da fonte não altera essa separação existente.

## Status de implantação

Os arquivos do repositório são os arquivos preparados para instalação. Eles não são instalados nem executados no Apps Script pelo GitHub. A configuração real, a atualização da implantação Google e a primeira sincronização precisam ser realizadas pelo responsável no editor Apps Script.
