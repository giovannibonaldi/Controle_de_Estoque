ESTOQUE AZUL V10 — CADASTRO COMPLETO + BASE DEMONSTRATIVA DE 12 MESES

COMO INICIAR
1. Instale o Node.js 22.13 ou superior.
2. Extraia todo o conteúdo do ZIP na mesma pasta.
3. Execute INICIAR_ESTOQUE.bat ou abra o terminal e use: npm start.
4. Acesse http://127.0.0.1:3000 e crie a conta inicial de administrador.
Não precisa executar npm init nem npm install.

NOVIDADES
- Cadastro de produtos em três etapas: identificação/categorias, preços/atacado/promoção, estoque/opções de PDV.
- Fotografia por link HTTPS ou upload do computador. Os links de demonstração precisam de internet e podem mudar se a fonte os remover.
- Prévia da imagem e cálculo automático do lucro bruto / margem sobre custo.
- 20 produtos reais identificáveis; valores, datas, fornecedores e históricos são totalmente fictícios.
- 3.283 movimentações (vendas/entradas/ajustes) no período de 15/10/2025 a 15/10/2026, com 40 eventos fictícios para tendências.
- Preços por tipo de venda: promoção em seu intervalo, atacado a partir da quantidade mínima, venda a prazo para cartão de crédito e à vista no pagamento em dinheiro.
- Estoque controlado: verifica saldo; sem controle: permite venda e não altera estoque pela operação.
- Marcação de produto sazonal, estoque mínimo, marca, grupo, subgrupo, tamanho, comissão, composição e observações.
- Conserva o login, permissões, alertas, tendências, relatórios, backup e atualização de estoque.

ATENÇÃO: DADOS DEMONSTRATIVOS
- A demonstração é carregada AUTOMATICAMENTE apenas na primeira execução de uma instalação com banco de dados novo.
- Se já tiver a pasta dados/ da V9, NADA será substituído.
- O botão 'Restaurar exemplo', exclusivo do administrador, SOBRESCREVE os dados atuais somente após DUAS confirmações. Faça Backup primeiro.
- O arquivo de base está em demonstracao/demo_12_meses_20_produtos.json.
- A lista das fontes de imagens externas está em demonstracao/fontes_fotografias.csv. Não oferecemos licenças para redistribuir as imagens comerciais: confirme direitos de uso antes de publicar.
- O indicador de balança e o modo mesas/comandas são metadados de cadastro; não conectam equipamentos nem habilitam gestão completa de comandas.

MIGRAÇÃO DA V9
- Feche o servidor e faça cópia integral da pasta dados/ antes de atualizar.
- Mantenha dados/ na mesma pasta, substituindo somente arquivos de aplicação.
- Não use 'Restaurar exemplo' sobre dados reais.
- Ao editar um produto antigo, os novos campos passam a ficar disponíveis com valores padrão.

ARQUIVOS
server.js — Servidor Node + autorização + SQLite.
index.html — Site e telas de cadastro.
script.js, pdv.js, auth.js, trends.js — Lógica.
styles.css, theme.css, auth.css, pdv.css, cadastro.css — Estilos.
demonstracao/demo_12_meses_20_produtos.json — Dados fictícios.
demonstracao/fontes_fotografias.csv — URLs / fontes das 20 fotografias.

NOVA APRESENTAÇÃO VISUAL INTEGRADA (V10 - REDESIGN)
- Página pública completa em HTML/CSS inspirada na referência azul enviada: topo, prévia de painel, recursos, benefícios, FAQ e acesso ao login.
- Ao clicar em Entrar/Acessar sistema, abre o login; na primeira instalação, permite criar administrador.
- Após login, a página Início traz um novo painel visual com atalhos antes do PDV, preservando as funções existentes.
- Dados e permissões continuam no servidor; a página de apresentação não expõe dados privados.
- Os números exibidos na apresentação são da base DEMONSTRATIVA fictícia, não de clientes reais.
- landing.css e landing.js são arquivos adicionais necessários ao layout.
