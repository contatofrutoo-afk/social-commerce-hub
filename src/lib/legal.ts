// Fonte única dos documentos jurídicos da weaze.
// Ao alterar o conteúdo, incremente a versão e a data — novos aceites serão solicitados.

export const LEGAL_VERSION = "2.0";
export const LEGAL_UPDATED_AT = "07 de agosto de 2026";

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
      "A weaze é um SaaS de autoatendimento digital para negócios locais. Nossa plataforma oferece infraestrutura tecnológica para que cada estabelecimento tenha seu próprio ambiente digital de atendimento: catálogo, pedidos, solicitações, agendamentos, relacionamento com clientes e inteligência de negócio.",
      "O cliente acessa o ambiente de cada estabelecimento por QR Code, link compartilhado, link da bio, campanhas, materiais impressos ou redes sociais do próprio estabelecimento. Cada empresa possui seu espaço próprio dentro da plataforma — não existe compartilhamento de clientes entre estabelecimentos, e cada empresa é responsável apenas pelos seus próprios clientes.",
      "A weaze não é uma rede social nem um marketplace: não vendemos produtos próprios e não participamos das vendas ou da prestação de serviços anunciados pelos estabelecimentos.",
      "Esta Política explica, de forma direta, quais dados a weaze trata, por que trata, com quem compartilha e quais são os seus direitos, em conformidade com a Lei nº 13.709/2018 (LGPD).",
    ],
  },
  {
    id: "quem",
    title: "2. Quem são os titulares e os controladores",
    blocks: [
      "A weaze atua de duas formas: como controladora dos dados de cadastro dos estabelecimentos (área B2B) e como operadora dos dados dos clientes finais coletados em nome de cada estabelecimento parceiro (área B2C).",
      "Isso significa que o estabelecimento é o responsável primário pela relação comercial com seus clientes, e a weaze fornece a tecnologia que registra e organiza essa relação dentro do ambiente digital daquele estabelecimento.",
    ],
  },
  {
    id: "dados",
    title: "3. Quais dados coletamos",
    blocks: [
      {
        subtitle: "Dados de cadastro do cliente (B2C)",
        items: [
          "Nome, e-mail e telefone.",
          "Nome de usuário e senha criptografada, quando houver conta.",
          "Foto de perfil — opcional, se você optar por enviar.",
          "Cidade — quando informada.",
        ],
      },
      {
        subtitle: "Dados de cadastro da empresa (B2B)",
        items: [
          "Nome da empresa e CNPJ — quando informado.",
          "Segmento, endereço comercial e telefone comercial — quando informados.",
          "Redes sociais e horário de funcionamento.",
          "E-mail e senha criptografada de acesso ao painel administrativo.",
        ],
      },
      {
        subtitle: "Dados operacionais",
        items: [
          "Histórico de pedidos, solicitações e atendimentos.",
          "Agendamentos e conversas no chat.",
          "Utilização de cupons, pontos de fidelidade e recompensas resgatadas.",
          "Favoritos e histórico da sacola.",
          "Interações necessárias ao funcionamento da plataforma.",
        ],
      },
      {
        subtitle: "Dados técnicos",
        items: [
          "Endereço de IP, navegador, dispositivo e sistema operacional.",
          "Data e horário de acesso e logs de autenticação.",
          "Cookies, quando utilizados, e informações necessárias à segurança da plataforma.",
        ],
      },
      "A weaze não coleta localização precisa em segundo plano e não acessa sua agenda de contatos. Dados sensíveis (como saúde, biometria, religião ou opinião política) não são tratados, salvo se estritamente necessários ao funcionamento de algum recurso e sempre com base legal específica.",
    ],
  },
  {
    id: "finalidade",
    title: "4. Para que usamos os dados",
    blocks: [
      {
        subtitle: "Finalidades",
        items: [
          "Autenticação e funcionamento da conta.",
          "Atendimento ao cliente e processamento de pedidos e solicitações.",
          "Organização de agendamentos e comunicação entre empresa e cliente.",
          "Funcionamento do catálogo, emissão de cupons e gerenciamento do programa de fidelidade.",
          "Envio de notificações relacionadas ao serviço.",
          "Prevenção a fraudes, segurança da plataforma e cumprimento de obrigações legais.",
          "Melhoria contínua do sistema.",
        ],
      },
      "As bases legais utilizadas são: execução de contrato e procedimentos preliminares (art. 7º, V), legítimo interesse do estabelecimento em conhecer o próprio público (art. 7º, IX), consentimento para dados opcionais e comunicações (art. 7º, I) e cumprimento de obrigação legal (art. 7º, II).",
      "A weaze não vende dados pessoais. Os dados pessoais não são comercializados, tampouco compartilhados com terceiros sem base legal específica.",
    ],
  },
  {
    id: "catalogo",
    title: "5. Catálogo",
    blocks: [
      "Os produtos e serviços exibidos no catálogo de cada ambiente digital pertencem exclusivamente ao estabelecimento responsável.",
      "A weaze apenas disponibiliza a infraestrutura tecnológica para exibição dessas informações. A responsabilidade pelas descrições, preços, disponibilidade e qualidade dos produtos e serviços é do estabelecimento.",
    ],
  },
  {
    id: "pedidos",
    title: "6. Pedidos",
    blocks: [
      "Os pedidos realizados pelo cliente são compartilhados exclusivamente entre o cliente e o estabelecimento escolhido.",
      "A weaze realiza apenas o processamento tecnológico dessas informações, sem participar da relação comercial entre as partes.",
    ],
  },
  {
    id: "solicitacoes",
    title: "7. Solicitações",
    blocks: [
      "Caso o cliente envie solicitações ou pedidos de orçamento, essas informações serão disponibilizadas somente ao estabelecimento correspondente, para que ele possa responder e prestar o atendimento.",
    ],
  },
  {
    id: "chat",
    title: "8. Chat",
    blocks: [
      "As conversas no chat são privadas: somente o cliente e o estabelecimento possuem acesso.",
      "As mensagens poderão permanecer armazenadas para garantir a continuidade do atendimento, a segurança da plataforma e o cumprimento de obrigações legais.",
    ],
  },
  {
    id: "agenda",
    title: "9. Agenda",
    blocks: [
      "Os dados de agendamento são utilizados apenas para organizar os atendimentos entre o cliente e a empresa, incluindo avisos e lembretes relacionados ao horário marcado.",
    ],
  },
  {
    id: "dashboard",
    title: "10. Dashboard",
    blocks: [
      "Cada empresa visualiza exclusivamente os próprios indicadores e dados de seus clientes. Não existe acesso às informações de outras empresas, nem ao histórico de clientes de outros estabelecimentos.",
    ],
  },
  {
    id: "qrcode",
    title: "11. QR Code",
    blocks: [
      "O QR Code serve apenas para direcionar o usuário ao ambiente digital daquele estabelecimento.",
      "A leitura do QR Code não transmite automaticamente dados pessoais do usuário. A coleta de dados ocorre apenas quando o cliente interage com o ambiente, como no check-in ou no cadastro.",
    ],
  },
  {
    id: "fidelidade",
    title: "12. Programa de fidelidade",
    blocks: [
      "Poderão ser armazenados o saldo de pontos, campanhas, recompensas e o histórico de utilização do programa de fidelidade.",
      "Esses dados pertencem exclusivamente à relação entre o cliente e o estabelecimento e não são compartilhados com outros estabelecimentos.",
    ],
  },
  {
    id: "cupons",
    title: "13. Cupons",
    blocks: [
      "Poderão ser registrados os cupons utilizados, sua validade, o estabelecimento emissor e o histórico de utilização.",
      "Os cupons são emitidos e gerenciados pelos estabelecimentos dentro do seu próprio ambiente digital.",
    ],
  },
  {
    id: "notificacoes",
    title: "14. Notificações",
    blocks: [
      "Poderão ser enviadas notificações relacionadas a pedidos, andamento do atendimento, agendamentos, cupons, fidelidade e comunicações importantes da plataforma.",
      "Caso existam notificações promocionais, o usuário terá opção de gerenciamento das suas preferências.",
    ],
  },
  {
    id: "seguranca",
    title: "15. Segurança da informação",
    blocks: [
      {
        subtitle: "Medidas técnicas e organizacionais",
        items: [
          "Criptografia em trânsito (HTTPS) e autenticação segura.",
          "Criptografia das credenciais (senhas com hash irreversível).",
          "Controle de acesso por perfil e políticas de acesso ao banco de dados.",
          "Registros de auditoria e monitoramento de segurança.",
          "Proteção contra acessos não autorizados.",
        ],
      },
      "Nenhum sistema é absolutamente inviolável. Em caso de incidente de segurança relevante, comunicaremos os titulares afetados e a ANPD nos prazos legais.",
    ],
  },
  {
    id: "retencao",
    title: "16. Por quanto tempo guardamos",
    blocks: [
      "Dados de clientes finais são mantidos enquanto houver relacionamento com o estabelecimento e por até 24 meses após a última interação, salvo prazo legal maior.",
      "Dados de contas de estabelecimento são mantidos enquanto o contrato estiver vigente e por até 5 anos após o encerramento, para cumprimento de obrigações fiscais e legais.",
      "Após esses prazos, os dados são excluídos ou anonimizados de forma irreversível.",
    ],
  },
  {
    id: "direitos",
    title: "17. Seus direitos como titular",
    blocks: [
      {
        subtitle: "Você pode, a qualquer momento",
        items: [
          "Acessar seus dados e confirmar a existência de tratamento.",
          "Corrigir e atualizar suas informações de cadastro.",
          "Solicitar a exclusão da conta e a eliminação de dados desnecessários.",
          "Solicitar informações sobre o tratamento dos seus dados.",
          "Solicitar a portabilidade/exportação dos dados, quando aplicável.",
          "Opor-se a tratamento realizado com base em legítimo interesse.",
          "Exercer todos os demais direitos previstos na LGPD.",
        ],
      },
      "Clientes finais encontram essas opções diretamente em Perfil › Privacidade. Estabelecimentos encontram em Configurações › Privacidade. Também é possível solicitar pelo canal de contato abaixo.",
    ],
  },
  {
    id: "cookies",
    title: "18. Política de Cookies",
    blocks: [
      {
        subtitle: "Tipos de cookies e armazenamento local que utilizamos",
        items: [
          "Essenciais: mantêm sua sessão ativa, guardam o token da visita e o conteúdo da sacola. Sem eles a plataforma não funciona e por isso não podem ser desativados.",
          "De funcionamento: guardam preferências de interface e evitam recarregamentos desnecessários, tornando a navegação mais rápida.",
          "De segurança: protegem a conta e evitam acessos não autorizados.",
        ],
      },
      "Os cookies são utilizados apenas para autenticação, funcionamento da plataforma, segurança e melhoria da experiência do usuário. Não utilizamos cookies de publicidade comportamental de terceiros nem redes de rastreamento cruzado entre sites. Quando aplicável, disponibilizaremos mecanismo de consentimento conforme a legislação. Você pode limpar os cookies e o armazenamento local pelo seu navegador a qualquer momento — isso encerrará sua sessão.",
    ],
  },
  {
    id: "menores",
    title: "19. Crianças e adolescentes",
    blocks: [
      "A weaze não é direcionada a menores de 13 anos. Menores de 18 anos só devem utilizar a plataforma com consentimento e supervisão dos responsáveis legais. Identificado o tratamento indevido de dados de criança, os registros são eliminados.",
    ],
  },
  {
    id: "alteracoes",
    title: "20. Alterações desta Política",
    blocks: [
      "Esta Política pode ser atualizada para refletir novas funcionalidades ou exigências legais. Toda versão possui número e data. Quando houver mudança relevante, solicitaremos novo aceite no próximo acesso.",
    ],
  },
  {
    id: "contato",
    title: "21. Contato e Encarregado (DPO)",
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
      "Estes Termos regulam o uso da weaze, um SaaS de autoatendimento digital para negócios locais. A plataforma fornece infraestrutura tecnológica para que cada estabelecimento tenha seu próprio ambiente digital: catálogo, pedidos, solicitações, agendamentos, cupons, programa de fidelidade e relacionamento com clientes.",
      "A weaze não é uma rede social nem um marketplace: não vende produtos próprios, não presta diretamente os serviços anunciados, não define os preços dos estabelecimentos e não interfere nas negociações entre empresa e cliente.",
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
          "weaze: a plataforma de autoatendimento digital e a empresa que a mantém.",
          "Estabelecimento: o negócio contratante que utiliza o painel B2B e mantém seu ambiente digital próprio.",
          "Cliente: a pessoa que acessa o ambiente digital de um estabelecimento e utiliza seus recursos.",
          "Conteúdo: textos, fotos, vídeos, comentários, produtos e serviços publicados na plataforma.",
          "Ambiente digital: o espaço individual de cada estabelecimento, acessado por QR Code, link compartilhado, link da bio, campanhas, materiais impressos ou redes sociais.",
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
      "O estabelecimento cria conta com e-mail e senha criptografada e é responsável pela veracidade das informações, pelo sigilo das credenciais e pelo uso da conta.",
      "O cliente se identifica no check-in com nome e telefone. A sessão é temporária e expira automaticamente, exigindo novo check-in em visitas posteriores.",
      "É proibido compartilhar credenciais, criar contas em nome de terceiros ou utilizar identidade falsa. O usuário é responsável pelo conteúdo que envia e pelo uso da sua conta.",
    ],
  },
  {
    id: "planos",
    title: "5. Planos, pagamento e liberação",
    blocks: [
      "O uso da área do estabelecimento é mediante assinatura. Após o cadastro, a conta permanece em aguardando pagamento até que o comprovante seja informado e analisado pela weaze.",
      "Confirmado o pagamento, a conta passa a ativa e o painel é liberado. Em caso de inadimplência, a conta pode ser bloqueada, com os dados preservados até eventual cancelamento.",
      "Valores, forma de pagamento e vencimento são exibidos na área de pagamento do painel.",
    ],
  },
  {
    id: "responsabilidades-usuario",
    title: "6. Responsabilidades do usuário",
    blocks: [
      {
        subtitle: "Ao usar a weaze, o usuário se compromete a",
        items: [
          "Fornecer informações verdadeiras e manter o cadastro atualizado.",
          "Utilizar a plataforma apenas para finalidades lícitas.",
          "Publicar apenas conteúdo próprio ou que tenha autorização para publicar.",
          "Respeitar demais clientes, funcionários e o estabelecimento.",
          "Manter o sigilo das credenciais e responder por todo o uso da sua conta.",
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
          "Manter as informações de produtos, serviços, estoque, disponibilidade, preços, promoções e prazos corretas e atualizadas.",
          "Prestar o atendimento e cumprir os pedidos, solicitações e agendamentos registrados na plataforma.",
          "Tratar os dados dos clientes exclusivamente para o relacionamento comercial, respeitando a LGPD.",
          "Não exportar, revender ou repassar dados de clientes a terceiros.",
          "Responder por promoções, cobranças, tributos e obrigações sanitárias e consumeristas do seu negócio.",
        ],
      },
      "Cada empresa é integralmente responsável pelo relacionamento comercial com seus clientes. A weaze fornece a tecnologia de autoatendimento e não participa da relação de consumo entre estabelecimento e cliente.",
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
    title: "9. Conteúdo publicado",
    blocks: [
      "O conteúdo publicado continua pertencendo ao seu autor. Ao publicar, você concede à weaze e ao estabelecimento uma licença não exclusiva e gratuita para exibir esse conteúdo dentro do ambiente digital daquele estabelecimento.",
      "O estabelecimento pode moderar, ocultar ou remover conteúdo do seu ambiente digital. A weaze pode remover conteúdo que viole estes Termos, mediante denúncia ou identificação própria.",
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
          "Catálogo: exibe produtos e serviços do estabelecimento, com fotos, descrições e preços definidos por ele.",
          "Sacola e Pedidos: registram a intenção de compra e a enviam ao painel do estabelecimento, que é responsável pelo atendimento.",
          "Solicitações: encaminhadas exclusivamente ao estabelecimento correspondente.",
          "Agenda: organiza os atendimentos e agendamentos entre o cliente e a empresa.",
          "Chat: conversas privadas entre o cliente e o estabelecimento.",
          "Cupons e Fidelidade: gerenciados pelo estabelecimento no seu próprio ambiente.",
          "Dashboard: cada empresa visualiza exclusivamente seus próprios indicadores.",
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
      "A weaze pode suspender ou encerrar contas em caso de fraude, abuso ou violação destes Termos, ou quando houver risco à segurança da plataforma ou de outros usuários, observadas as obrigações legais.",
      "O estabelecimento pode cancelar a assinatura a qualquer momento; o acesso permanece até o fim do período pago, sem devolução proporcional.",
      "O usuário pode solicitar a exclusão da conta a qualquer momento, observadas as obrigações legais de retenção de registros.",
    ],
  },
  {
    id: "limitacao",
    title: "14. Limitação de responsabilidade",
    blocks: [
      {
        subtitle: "A weaze não se responsabiliza por",
        items: [
          "Qualidade, entrega, preço, disponibilidade ou segurança dos produtos e serviços oferecidos pelo estabelecimento.",
          "Conteúdo publicado por usuários ou por estabelecimentos.",
          "Condutas de usuários dentro ou fora do ambiente físico.",
          "Danos indiretos, lucros cessantes ou perda de oportunidade.",
          "Indisponibilidades causadas por terceiros, conexão do usuário ou caso fortuito e força maior.",
        ],
      },
      "A plataforma fornece apenas tecnologia de autoatendimento: não vende produtos próprios, não presta diretamente os serviços anunciados, não define preços e não interfere nas negociações entre empresa e cliente. Nos limites permitidos pela lei, a responsabilidade total da weaze fica limitada ao valor pago pelo estabelecimento nos 3 meses anteriores ao evento.",
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
