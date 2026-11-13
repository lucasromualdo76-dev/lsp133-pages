# Mesmo visual do Apps Script no GitHub

O index.html usa o mesmo HTML, CSS, componentes e funções de renderização do Index fornecido pelo responsável. O adaptador de transporte lê somente data/indicadores.json, sem credenciais no navegador. Produção, histórico de capturas e Expedição são exibidos pelos mesmos componentes.

Instale a versão atualizada de AppsScript_Sync_LSP133.gs no arquivo Sync_GitHub.gs do projeto Google e execute syncLsp133ToGitHub. O campo appViews contém as mesmas séries agregadas de produção, histórico e pacotes auditados calculadas pelas funções existentes do Apps Script. A conta responsável mantém o gatilho de sincronização já instalado. Não é necessário mudar Index.html do projeto Google nesta etapa.

O GitHub Pages é estático. Atualizar SPX, salvar capturas, dados por AT, horários e áreas Insucessos/Erros continuam na Central autenticada do Google. O usuário é direcionado a ela ao usar essas ações. O site público não recebe BRs, ATs, nomes, tokens ou credenciais. Os totais públicos mantêm o instante da publicação explicitamente indicado na tela.

Testado no navegador em desktop e celular: cartões, filtros, gráficos de barras, tabela diária, ausência de dados, transporte de erro e encaminhamento autenticado. Não alterar manualmente o JSON para inserir dados restritos.
