# Expedição: mesmos valores da planilha

Fonte única: Validação de Dados - Fonte Dashboard - Lucas, aba Expedição Hoje.

- Total de rotas: D3.
- Assigned: F3.
- Complete: H3.
- Pacotes expedidos: soma das linhas válidas do resumo F:J, coluna J.
- Data operacional, Assigned, Complete, Total e Pacotes: as mesmas linhas F:J, excluindo a linha Total.
- Corte: o aplicado pela própria aba, desde ontem às 21h até a consulta, America/Sao_Paulo.

O backend confere cartões, ATs únicas e resumo por data operacional antes de retornar valores. Usa números nativos do Sheets, sem transformar 1,703 em 1.703. Created e qualquer outro status são rejeitados no conjunto de expedição. A atribuição não comprova saída física.

## Instalação no projeto existente

1. Substitua o conteúdo do módulo existente Expedição_LSP133.gs por Expedicao_LSP133.gs desta integração (o nome do arquivo pode ser mantido; não duplique as funções).
2. Substitua Sync_GitHub.gs por AppsScript_Sync_LSP133.gs desta integração.
3. Substitua Index.html pela versão completa disponibilizada ao responsável no Drive. Esse arquivo privado não é incluído no site público.
4. Execute instalarAutomacaoExpedicaoLSP133 uma vez. Ela valida a leitura, captura o dia e configura capturas a cada 15 minutos e perto do fim do dia. O proprietário deve autorizar os acessos Google solicitados pelo Apps Script.
5. Execute syncLsp133ToGitHub para publicar os agregados imediatamente.
6. Publique nova versão da implantação existente do Apps Script.

SOURCE_SPREADSHEET_ID deve ser 1qqVpEFAH2mFkmDNKVOV1POGr1UamHAgQew7NojlyCOc. O módulo bloqueia a leitura se a propriedade aponta para outra fonte.

## Histórico diário

Histórico Diário Expedição armazena a última fotografia de cada data: Assigned, Complete, Total, Pacotes, início da janela, hora de consulta, hora de captura e resumo por data operacional. A mesma data é atualizada em sua própria linha, sem somar capturas repetidas. ATs e BRs não são publicados no GitHub.

Não foram reconstruídos dias antigos a partir de capturas que usavam outra regra. Dias sem captura permanecem sem informação. Os cartões mostram o turno atual; o filtro de datas controla a tabela e o gráfico diários. A busca de AT afeta somente os detalhes de ATs, mantendo os totais iguais à planilha. Os totais de dias diferentes são fotografias, não um conjunto deduplicado de ATs entre dias.

A publicação inicial contém uma captura verificada da planilha em 13/11/2026 às 13:28:08: 87 rotas, 76 Assigned, 11 Complete e 12.887 pacotes. Isso não representa uma nova extração SPX. A atualização contínua depende da instalação dos arquivos e gatilhos no Google pelo proprietário.

Se o sincronizador antigo publicar um JSON sem expeditionTurn, a página mostra uma pendência de sincronização, em vez de voltar a números calculados com outro critério.
