// Fonte única dos documentos jurídicos da weaze.
// Ao alterar o conteúdo, incremente a versão e a data — novos aceites serão solicitados.

export const LEGAL_VERSION = "1.0";
export const LEGAL_UPDATED_AT = "31 de julho de 2026";

export type LegalSection = {
  id: string;
  title: string;
  /** Parágrafos e listas. Strings iniciadas com "- " viram itens de lista. */
  blocks: (string | { subtitle: string; items: string[] })[];
};

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "sobre",
    title: "1. Sobre a weaze",
    blocks: [
      "A weaze é uma plataforma de Social Commerce da Vida Real. Nosso propósito é conectar o ambiente físico ao digital: quando uma pessoa visita um estabelecimento parceiro e faz check-in por QR Code, a weaze transforma essa visita presencial em uma experiência digital — feed, catálogo inteligente, pedidos e relacionamento.",
      "Do lado do estabelecimento, essas interações se convertem em inteligência comercial: entender quem visita, com que frequência, o que consome, o que gosta e como se relaciona com a marca.",
      "Esta Política explica, de forma direta, quais dados a weaze trata, por que trata, com quem compartilha e quais são os seus direitos, em conformidade com a Lei nº 13.709/2018 (LGPD).",
    ],
  },
  {
    id: "quem",
    title: "2. Quem são os titulares e os controladores",
    blocks: [
      "A weaze atua de duas formas: como controladora dos dados de cadastro dos estabelecimentos (área B2B) e como operadora dos dados dos clientes finais coletados em nome de cada estabelecimento parceiro (área B2C).",
      "Isso significa que o estabelecimento onde você fez check-in é o responsável primário pela relação comercial com você, e a weaze fornece a tecnologia que registra e organiza essa relação.",
    ],
  },
  {
    id: "dados",
    title: "3. Quais dados coletamos",
    blocks: [
      {
        subtitle: "Dados fornecidos por você (cliente final)",
        items: [
          "Nome — obrigatório no check-in.",
          "WhatsApp — obrigatório no check-in, usado como identificador da sua visita.",
          "Foto de perfil — opcional, se você optar por enviar.",
          "Conteúdo que você publica: textos, fotos, vídeos e comentários no feed.",
        ],
      },
      {
        subtitle: "Dados fornecidos pelo estabelecimento (conta B2B)",
        items: [
          "E-mail e senha de acesso ao painel.",
          "Nome do negócio, responsável, telefone, cidade e dados de identidade visual.",
          "Informações de plano, mensalidade e comprovantes de pagamento.",
        ],
      },
      {
        subtitle: "Dados gerados automaticamente pelo uso",
        items: [
          "Check-ins e check-outs, com data, horário, dia da semana e origem (QR Code ou link).",
          "Contexto da visita (sozinho, casal, amigos, família) e mesa utilizada, quando informados.",
          "Produtos visualizados, escaneados, adicionados à sacola e pedidos realizados.",
          "Curtidas, desejos, reações, comentários e compartilhamentos.",
          "Frequência de visitas, tempo entre visitas, recorrência e preferências inferidas.",
          "Métricas agregadas de engajamento e comportamento dentro da plataforma.",
        ],
      },
      "A weaze não coleta localização precisa em segundo plano, não acessa sua agenda de contatos, não lê suas conversas de WhatsApp e não coleta dados sensíveis (como saúde, biometria, religião ou opinião política).",
    ],
  },
  {
    id: "finalidade",
    title: "4. Para que usamos os dados",
    blocks: [
      {
        subtitle: "Finalidades",
        items: [
          "Identificar você em novas visitas sem exigir cadastro repetido.",
          "Exibir o feed, o catálogo inteligente e o histórico dos seus pedidos.",
          "Personalizar recomendações de produtos e conteúdos.",
          "Gerar métricas e relatórios de desempenho para o estabelecimento.",
          "Construir Personas Inteligentes — perfis analíticos que descrevem padrões de público.",
          "Apoiar decisões comerciais do estabelecimento (cardápio, horários, campanhas).",
          "Prevenir fraudes, abusos e uso indevido da plataforma.",
        ],
      },
      "As bases legais utilizadas são: execução de contrato e procedimentos preliminares (art. 7º, V), legítimo interesse do estabelecimento em conhecer o próprio público (art. 7º, IX), consentimento para dados opcionais e comunicações (art. 7º, I) e cumprimento de obrigação legal (art. 7º, II).",
      "A weaze não vende dados pessoais. Nunca. Também não compartilha dados pessoais com terceiros sem base legal específica.",
    ],
  },
  {
    id: "ia",
    title: "5. Inteligência Artificial",
    blocks: [
      "A weaze utiliza modelos de inteligência artificial para transformar dados de uso em leitura de negócio. A IA é aplicada para identificar padrões de comportamento, gerar insights sobre público e produtos, produzir sugestões automáticas para o estabelecimento e descrever personas.",
      "Nenhuma decisão automatizada da IA produz efeitos jurídicos sobre você nem restringe seus direitos. Os resultados são sugestões analíticas dirigidas ao estabelecimento.",
      "Quando os dados são enviados a provedores de IA, eles trafegam de forma criptografada, são usados apenas para gerar a resposta solicitada e não são utilizados para treinar modelos de terceiros.",
      "Você pode solicitar revisão humana de qualquer análise que envolva seus dados, conforme o art. 20 da LGPD.",
    ],
  },
  {
    id: "compartilhamento",
    title: "6. Compartilhamento de dados",
    blocks: [
      {
        subtitle: "Com quem seus dados podem ser compartilhados",
        items: [
          "Com o estabelecimento onde você fez check-in: apenas as informações necessárias ao relacionamento comercial (nome, WhatsApp, histórico de visitas, pedidos e interações naquele estabelecimento).",
          "Com provedores de infraestrutura, banco de dados, armazenamento e IA, sob contrato e obrigação de confidencialidade.",
          "Com autoridades públicas, quando houver ordem legal ou judicial.",
        ],
      },
      "Um estabelecimento nunca acessa dados de clientes de outro estabelecimento. Análises que cruzam múltiplos negócios são sempre anonimizadas e agregadas, sem qualquer identificação individual.",
    ],
  },
  {
    id: "seguranca",
    title: "7. Segurança da informação",
    blocks: [
      {
        subtitle: "Medidas técnicas e organizacionais",
        items: [
          "Criptografia em trânsito (HTTPS/TLS) em toda a plataforma e criptografia em repouso no banco de dados.",
          "Autenticação por e-mail e senha com hash irreversível para contas de estabelecimento.",
          "Sessões temporárias e tokens opacos para clientes finais, com expiração automática.",
          "Controle de acesso por linha (Row Level Security), garantindo que cada empresa só enxergue os próprios dados.",
          "Arquivos sensíveis armazenados em bucket privado, acessíveis apenas por links assinados e temporários.",
          "Registro de eventos e monitoramento de acessos administrativos.",
        ],
      },
      "Nenhum sistema é absolutamente inviolável. Em caso de incidente de segurança relevante, comunicaremos os titulares afetados e a ANPD nos prazos legais.",
    ],
  },
  {
    id: "retencao",
    title: "8. Por quanto tempo guardamos",
    blocks: [
      "Dados de clientes finais são mantidos enquanto houver relacionamento com o estabelecimento e por até 24 meses após a última interação, salvo prazo legal maior.",
      "Dados de contas de estabelecimento são mantidos enquanto o contrato estiver vigente e por até 5 anos após o encerramento, para cumprimento de obrigações fiscais e legais.",
      "Após esses prazos, os dados são excluídos ou anonimizados de forma irreversível.",
    ],
  },
  {
    id: "direitos",
    title: "9. Seus direitos como titular",
    blocks: [
      {
        subtitle: "Você pode, a qualquer momento",
        items: [
          "Confirmar a existência de tratamento e acessar seus dados.",
          "Corrigir dados incompletos, inexatos ou desatualizados.",
          "Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários.",
          "Solicitar a portabilidade/exportação dos seus dados.",
          "Revogar o consentimento e solicitar a exclusão da conta.",
          "Obter informação sobre com quem seus dados foram compartilhados.",
          "Opor-se a tratamento realizado com base em legítimo interesse.",
        ],
      },
      "Clientes finais encontram essas opções diretamente em Perfil › Privacidade. Estabelecimentos encontram em Configurações › Privacidade. Também é possível solicitar pelo canal de contato abaixo.",
    ],
  },
  {
    id: "cookies",
    title: "10. Política de Cookies",
    blocks: [
      {
        subtitle: "Tipos de cookies e armazenamento local que utilizamos",
        items: [
          "Essenciais: mantêm sua sessão ativa, guardam o token da visita e o conteúdo da sacola. Sem eles a plataforma não funciona e por isso não podem ser desativados.",
          "De desempenho: guardam preferências de interface e evitam recarregamentos desnecessários, tornando a navegação mais rápida.",
          "Analíticos: medem, de forma agregada, quais páginas e produtos recebem mais atenção, para melhorar a plataforma.",
        ],
      },
      "Não utilizamos cookies de publicidade comportamental de terceiros nem redes de rastreamento cruzado entre sites. Você pode limpar os cookies e o armazenamento local pelo seu navegador a qualquer momento — isso encerrará sua sessão.",
    ],
  },
  {
    id: "menores",
    title: "11. Crianças e adolescentes",
    blocks: [
      "A weaze não é direcionada a menores de 13 anos. Menores de 18 anos só devem utilizar a plataforma com consentimento e supervisão dos responsáveis legais. Identificado o tratamento indevido de dados de criança, os registros são eliminados.",
    ],
  },
  {
    id: "alteracoes",
    title: "12. Alterações desta Política",
    blocks: [
      "Esta Política pode ser atualizada para refletir novas funcionalidades ou exigências legais. Toda versão possui número e data. Quando houver mudança relevante, solicitaremos novo aceite no próximo acesso.",
    ],
  },
  {
    id: "contato",
    title: "13. Contato e Encarregado (DPO)",
    blocks: [
      "Para exercer seus direitos, tirar dúvidas ou reportar um incidente de privacidade, fale com o nosso Encarregado de Proteção de Dados pelo e-mail privacidade@weaze.com.br.",
      "Responderemos em até 15 dias corridos. Você também pode peticionar diretamente à Autoridade Nacional de Proteção de Dados (ANPD).",
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "objeto",
    title: "1. Objeto e aceitação",
    blocks: [
      "Estes Termos regulam o uso da weaze, plataforma de Social Commerce da Vida Real que conecta estabelecimentos físicos aos seus clientes por meio de check-in por QR Code, feed, catálogo inteligente, pedidos, CRM e inteligência de dados.",
      "Ao criar uma conta, fazer check-in ou utilizar qualquer funcionalidade, você declara que leu, compreendeu e concorda integralmente com estes Termos e com a Política de Privacidade.",
    ],
  },
  {
    id: "definicoes",
    title: "2. Definições",
    blocks: [
      {
        subtitle: "Para efeito destes Termos",
        items: [
          "weaze: a plataforma e a empresa que a mantém.",
          "Estabelecimento: o negócio contratante que utiliza o painel B2B.",
          "Cliente: a pessoa que faz check-in e utiliza a área B2C do estabelecimento.",
          "Conteúdo: textos, fotos, vídeos, comentários e produtos publicados na plataforma.",
        ],
      },
    ],
  },
  {
    id: "quem-pode",
    title: "3. Quem pode utilizar",
    blocks: [
      "A área do estabelecimento é destinada a pessoas jurídicas ou profissionais autônomos regularmente estabelecidos, representados por pessoa maior de 18 anos com poderes para contratar.",
      "A área do cliente é destinada a pessoas maiores de 13 anos; menores de 18 anos devem ter autorização dos responsáveis legais.",
    ],
  },
  {
    id: "cadastro",
    title: "4. Cadastro e acesso",
    blocks: [
      "O estabelecimento cria conta com e-mail e senha e é responsável pela veracidade das informações e pelo sigilo das credenciais. O acesso ao painel depende da confirmação de pagamento e liberação pela weaze.",
      "O cliente se identifica com nome e WhatsApp no check-in. A sessão é temporária e expira automaticamente, exigindo novo check-in em visitas posteriores.",
      "É proibido compartilhar credenciais, criar contas em nome de terceiros ou utilizar identidade falsa.",
    ],
  },
  {
    id: "planos",
    title: "5. Planos, pagamento e liberação",
    blocks: [
      "O uso da área do estabelecimento é mediante assinatura mensal. Após o cadastro, a conta permanece em aguardando pagamento até que o comprovante seja informado e analisado pela weaze.",
      "Confirmado o pagamento, a conta passa a ativa e o painel é liberado. Em caso de inadimplência, a conta pode ser bloqueada, com os dados preservados até eventual cancelamento.",
      "Valores, forma de pagamento e vencimento são exibidos na área de pagamento do painel.",
    ],
  },
  {
    id: "responsabilidades-usuario",
    title: "6. Responsabilidades do cliente",
    blocks: [
      {
        subtitle: "Ao usar a weaze, o cliente se compromete a",
        items: [
          "Fornecer informações verdadeiras no check-in.",
          "Publicar apenas conteúdo próprio ou que tenha autorização para publicar.",
          "Respeitar demais clientes, funcionários e o estabelecimento.",
          "Utilizar o feed, os comentários e os pedidos de boa-fé.",
        ],
      },
    ],
  },
  {
    id: "responsabilidades-empresa",
    title: "7. Responsabilidades do estabelecimento",
    blocks: [
      {
        subtitle: "O estabelecimento é responsável por",
        items: [
          "Manter o catálogo, preços, disponibilidade e descrições corretos e atualizados.",
          "Cumprir os pedidos registrados na plataforma e atender os clientes presencialmente.",
          "Tratar os dados dos clientes exclusivamente para o relacionamento comercial, respeitando a LGPD.",
          "Não exportar, revender ou repassar dados de clientes a terceiros.",
          "Responder por promoções, cobranças, tributos e obrigações sanitárias e consumeristas do seu negócio.",
        ],
      },
      "A weaze é fornecedora de tecnologia e não participa da relação de consumo entre estabelecimento e cliente, nem processa pagamentos de pedidos.",
    ],
  },
  {
    id: "condutas",
    title: "8. Condutas proibidas",
    blocks: [
      {
        subtitle: "É expressamente vedado",
        items: [
          "Publicar conteúdo ilegal, ofensivo, discriminatório, violento, sexual ou que viole direitos de terceiros.",
          "Praticar spam, assédio ou uso da plataforma para captação abusiva.",
          "Tentar acessar dados de outros usuários ou de outros estabelecimentos.",
          "Realizar engenharia reversa, raspagem automatizada, injeção de código ou testes de intrusão sem autorização.",
          "Sobrecarregar a infraestrutura com requisições automatizadas.",
          "Utilizar a plataforma para atividade ilícita de qualquer natureza.",
        ],
      },
    ],
  },
  {
    id: "conteudo",
    title: "9. Conteúdo publicado e feed",
    blocks: [
      "O conteúdo publicado continua pertencendo ao seu autor. Ao publicar, você concede à weaze e ao estabelecimento uma licença não exclusiva e gratuita para exibir esse conteúdo dentro da plataforma daquele estabelecimento.",
      "O estabelecimento pode moderar, ocultar ou remover conteúdo do seu feed. A weaze pode remover conteúdo que viole estes Termos, mediante denúncia ou identificação própria.",
      "O autor pode editar ou excluir suas próprias publicações a qualquer momento.",
    ],
  },
  {
    id: "funcionalidades",
    title: "10. Funcionamento das funcionalidades",
    blocks: [
      {
        subtitle: "Como cada recurso opera",
        items: [
          "Check-in: registra sua presença por QR Code ou link, cria a sessão temporária e libera o feed e o catálogo.",
          "Catálogo Inteligente: exibe produtos com fotos, vídeos e detalhes, registrando visualizações e interesses.",
          "Sacola e Pedidos: registram a intenção de compra e a enviam ao painel do estabelecimento. O pagamento ocorre no local, entre cliente e estabelecimento.",
          "CRM, Persona e Métricas: organizam as interações em leitura analítica para o estabelecimento.",
          "Notificações: informam o estabelecimento sobre novos check-ins, pedidos e interações.",
        ],
      },
    ],
  },
  {
    id: "propriedade",
    title: "11. Propriedade intelectual",
    blocks: [
      "A marca weaze, o software, a interface, os textos, o design, os fluxos e os modelos analíticos são de propriedade exclusiva da weaze e protegidos pela Lei nº 9.610/1998 e pela Lei nº 9.609/1998.",
      "Nada nestes Termos transfere qualquer direito de propriedade intelectual ao usuário; concede-se apenas licença de uso limitada, revogável e intransferível durante a vigência da conta.",
    ],
  },
  {
    id: "disponibilidade",
    title: "12. Disponibilidade e atualizações",
    blocks: [
      "A weaze busca a máxima disponibilidade, mas o serviço pode sofrer interrupções por manutenção, falhas de terceiros ou eventos fora do seu controle.",
      "Funcionalidades podem ser criadas, alteradas ou descontinuadas para evolução do produto. Mudanças relevantes serão comunicadas com antecedência razoável.",
    ],
  },
  {
    id: "suspensao",
    title: "13. Suspensão, cancelamento e encerramento",
    blocks: [
      "A weaze pode suspender ou encerrar contas que violem estes Termos, apresentem risco à segurança, à plataforma ou a outros usuários, ou estejam inadimplentes.",
      "O estabelecimento pode cancelar a assinatura a qualquer momento; o acesso permanece até o fim do período pago, sem devolução proporcional.",
      "O cliente pode encerrar sua participação solicitando a exclusão dos dados em Perfil › Privacidade.",
    ],
  },
  {
    id: "limitacao",
    title: "14. Limitação de responsabilidade",
    blocks: [
      {
        subtitle: "A weaze não se responsabiliza por",
        items: [
          "Qualidade, entrega, preço ou segurança dos produtos e serviços oferecidos pelo estabelecimento.",
          "Conteúdo publicado por usuários ou por estabelecimentos.",
          "Condutas de usuários dentro ou fora do ambiente físico.",
          "Danos indiretos, lucros cessantes ou perda de oportunidade.",
          "Indisponibilidades causadas por terceiros, conexão do usuário ou caso fortuito e força maior.",
        ],
      },
      "Nos limites permitidos pela lei, a responsabilidade total da weaze fica limitada ao valor pago pelo estabelecimento nos 3 meses anteriores ao evento.",
    ],
  },
  {
    id: "alteracoes-termos",
    title: "15. Alterações destes Termos",
    blocks: [
      "Estes Termos podem ser atualizados. Cada versão possui número e data de publicação. Quando houver alteração relevante, será solicitado novo aceite no próximo acesso, e o uso continuado após a atualização implica concordância.",
    ],
  },
  {
    id: "foro",
    title: "16. Legislação aplicável e foro",
    blocks: [
      "Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial o Código Civil, o Código de Defesa do Consumidor, o Marco Civil da Internet (Lei nº 12.965/2014) e a LGPD (Lei nº 13.709/2018).",
      "Fica eleito o foro da comarca do domicílio do usuário consumidor para dirimir controvérsias; nas relações entre a weaze e estabelecimentos, o foro da sede da weaze.",
      "Dúvidas sobre estes Termos: contato@weaze.com.br.",
    ],
  },
];
