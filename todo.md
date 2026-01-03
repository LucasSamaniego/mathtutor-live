# MathTutor Live - TODO

## Configuração Inicial
- [x] Schema do banco de dados (rooms, sessions, participants, recordings, transcriptions)
- [x] Configurar rotas tRPC para todas as funcionalidades
- [x] Configurar tema visual (azul, branco, cinza)

## Sistema de Videoconferência
- [x] Integração com WebRTC para videoconferência (preparado para Daily.co)
- [x] Diferenciação de papéis (Professor/Aluno)
- [x] Compartilhamento de tela com baixa latência
- [x] Geração de links únicos de sessão (app.com/sala/[slug])
- [x] Acesso de convidados sem login obrigatório
- [x] Controles de mute e câmera

## Ferramentas Pedagógicas
- [x] Visualizador de PDF com react-pdf
- [x] Renderização LaTeX em tempo real com KaTeX
- [x] Área de input dedicada para sintaxe LaTeX
- [x] Layout split-screen/grid responsivo

## Shadow Tutor (Assistente IA)
- [x] Sidebar de chat colapsável exclusivo para estudantes
- [x] Integração com OpenAI GPT-4o via LLM helper
- [x] System prompt configurado para tutor de matemática
- [x] Renderização de fórmulas LaTeX nas respostas

## Gravação e Transcrição
- [x] Gravação de sessões de videoconferência
- [x] Armazenamento de vídeos no S3 (estrutura preparada)
- [x] Metadados de gravação no banco de dados
- [x] Transcrição automática com Whisper (estrutura preparada)
- [x] Notas de aula em texto para revisão

## Notificações
- [x] Notificação quando nova sessão é criada
- [x] Notificação quando aluno entra na sala
- [x] Notificação quando sessão é finalizada com resumo

## Interface e UX
- [x] Design limpo em azul, branco e cinza
- [x] Interface totalmente em português brasileiro
- [x] Layout responsivo para desktop (prioridade) e tablets
- [x] Botão "Perguntar à IA" acessível
- [x] Página inicial com criação/entrada em salas
- [x] Dashboard do professor com histórico de sessões

## Novos Recursos (v2)

### Chat ao Vivo
- [x] Componente de chat em tempo real entre participantes
- [x] Mensagens sincronizadas na sessão
- [x] Indicador de digitação
- [x] Histórico de mensagens da sessão

### Visualização PDF lado a lado
- [x] Layout split-screen com PDF e vídeo
- [x] Controles de navegação do PDF
- [x] Sincronização de página entre professor e alunos
- [x] Zoom e ajuste de visualização

### Gráficos Interativos
- [x] Ferramenta para professor criar gráficos matemáticos
- [x] Suporte a funções (linear, quadrática, trigonométricas, exponenciais, cúbicas)
- [x] Alunos podem interagir com os gráficos
- [x] Controles de zoom e pan

### Gamificação
- [x] Sistema de pontos por acertos
- [x] Professor cria exercícios durante a aula
- [x] Alunos respondem e ganham pontos
- [x] Ranking em tempo real dos participantes
- [x] Feedback visual de acerto/erro

## Bugs Reportados (v2.1)

### Vídeo da Câmera
- [x] Vídeo da câmera não aparece na tela mesmo com câmera ativada
- [x] Corrigir componente VideoConference para exibir stream local

### Visualizador de PDF
- [x] PDF não é visualizado após seleção do arquivo
- [x] Corrigir componente PdfViewer para renderizar o documento

## Bugs Reportados (v2.2)

### Chat ao Vivo
- [x] Adicionar barra de rolagem no chat entre participantes

### Visualizador de PDF
- [x] PDF está travando a aplicação - corrigir carregamento (lazy loading implementado)

## Bugs Reportados (v2.3)

### Videoconferência
- [x] Mostrar vídeos de todos os participantes da aula, não apenas o próprio vídeo

### Visualizador de PDF
- [x] PDF ainda não está sendo visualizado - corrigido usando iframe nativo

## Novos Recursos (v2.4)

### Sincronização de PDF
- [x] Criar tabela/estado para armazenar documento e página atual da sessão
- [x] Criar rotas tRPC para professor atualizar e alunos receberem estado do PDF
- [x] Atualizar PdfViewer para sincronizar entre professor e alunos
- [x] Polling para alunos receberem atualizações em tempo real (a cada 2 segundos)
