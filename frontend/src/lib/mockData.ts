import type { EnrichedProfile } from "./types";

export const mockProfile: EnrichedProfile = {
  request_id: "a1b2c3d4-e5f6-4g7h-8i9j-0k1l2m3n4o5p",
  created_at: "2026-06-16T10:30:00Z",
  status: "complete",
  processing_duration_ms: 2847,
  input: {
    nombre_completo: "Juan Carlos García López",
    curp: "GARL700101HDFNRN09",
    rfc: "GARL700101ABC",
    telefono: "+52 55 1234 5678",
  },
  public_profile: {
    social_media: [
      {
        platform: "LinkedIn",
        url: "https://linkedin.com/in/jcgarcia",
        name: "Juan Carlos García",
        bio: "Senior Software Engineer | Tech Enthusiast",
        followers: 2345,
        public_posts_sample: [
          "Excited to announce I'm now leading the cloud infrastructure team!",
          "Just published an article on TypeScript best practices",
        ],
      },
      {
        platform: "Twitter",
        url: "https://twitter.com/jcgarcia_dev",
        name: "@jcgarcia_dev",
        followers: 1200,
        public_posts_sample: [
          "Building scalable systems with React and Node.js",
          "Learning Rust, it's challenging but rewarding!",
        ],
      },
      {
        platform: "GitHub",
        url: "https://github.com/jcgarcia",
        name: "jcgarcia",
        public_posts_sample: [],
      },
    ],
    news_mentions: [
      {
        title: "Tech Company Expands Leadership Team",
        source: "Business News Daily",
        date: "2026-04-15",
        url: "https://businessnewsdaily.com/article/tech-expansion",
        sentiment: "positive",
      },
      {
        title: "Industry Report: Top Engineering Minds",
        source: "Tech Industry Magazine",
        date: "2026-02-28",
        url: "https://techmag.com/report/engineering-leaders",
        sentiment: "positive",
      },
    ],
    public_records: [
      {
        type: "Registro de Empresa",
        source: "Registro Público de Comercio",
        date: "2020-03-10",
        description: "Co-founder de TechStartup S.A. de C.V.",
        url: "https://rpc.gob.mx/",
      },
      {
        type: "Propiedad Inmueble",
        source: "Registro Público de Propiedad",
        date: "2019-07-22",
        description: "Inmueble ubicado en Polanco, Ciudad de México",
        url: "https://rpp.gob.mx/",
      },
    ],
  },
  internal_history: {
    loans: [
      {
        id: "LOAN-001",
        amount: 500000,
        date: "2024-06-15",
        status: "active",
        days_overdue: 0,
      },
      {
        id: "LOAN-002",
        amount: 250000,
        date: "2023-01-10",
        status: "paid",
        days_overdue: 0,
      },
    ],
    payment_score: 850,
    references: [
      {
        name: "María Rodríguez",
        relationship: "Directora General",
        phone: "+52 55 5678 1234",
      },
      {
        name: "Pedro Martinez",
        relationship: "Socio Comercial",
        phone: "+52 55 4321 0987",
      },
    ],
  },
  sources_queried: [
    {
      source: "LinkedIn",
      status: "success",
      duration_ms: 245,
    },
    {
      source: "Twitter",
      status: "success",
      duration_ms: 187,
    },
    {
      source: "News APIs",
      status: "success",
      duration_ms: 892,
    },
    {
      source: "Government Records",
      status: "success",
      duration_ms: 1523,
    },
    {
      source: "Internal Database",
      status: "success",
      duration_ms: 156,
    },
  ],
};

export const mockProfiles = [
  {
    request_id: "profile-001",
    created_at: "2026-06-15T14:20:00Z",
    status: "complete" as const,
    input: {
      nombre_completo: "Juan Carlos García López",
      curp: "GARL700101HDFNRN09",
      rfc: "GARL700101ABC",
      telefono: "+52 55 1234 5678",
    },
  },
  {
    request_id: "profile-002",
    created_at: "2026-06-15T10:15:00Z",
    status: "complete" as const,
    input: {
      nombre_completo: "María González Sánchez",
      curp: "GOSM850305HDFRNN03",
      rfc: "GOSM850305XYZ",
      telefono: "+52 55 9876 5432",
    },
  },
  {
    request_id: "profile-003",
    created_at: "2026-06-14T16:45:00Z",
    status: "processing" as const,
    input: {
      nombre_completo: "Carlos Mendoza Ortiz",
      curp: "MEOC800715HDFMNN07",
      rfc: "MEOC800715DEF",
      telefono: "+52 55 5555 1111",
    },
  },
];
