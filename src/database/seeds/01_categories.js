import { clearDatabase } from './clear.js';

/**
 * 32 categorías de servicios iniciales para la plataforma on-demand.
 */
export const initialCategories = [
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f001',
    name: 'Limpieza',
    description: 'Servicios de limpieza del hogar, oficinas y fin de obra.',
    icon_url: 'https://cdn.startup.com/icons/cleaning.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f002',
    name: 'Plomería',
    description: 'Instalación y reparación de cañerías, griferías, pérdidas y destapaciones.',
    icon_url: 'https://cdn.startup.com/icons/plumbing.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f003',
    name: 'Electricidad',
    description: 'Instalaciones eléctricas, tableros, disyuntores, cortocircuitos y cableado.',
    icon_url: 'https://cdn.startup.com/icons/electricity.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f004',
    name: 'Jardinería y Paisajismo',
    description: 'Mantenimiento de jardines, corte de césped, poda de árboles y riego.',
    icon_url: 'https://cdn.startup.com/icons/gardening.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f005',
    name: 'Pintura',
    description: 'Pintura de interiores y exteriores, tratamiento de humedad y enduido.',
    icon_url: 'https://cdn.startup.com/icons/painting.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f006',
    name: 'Carpintería',
    description: 'Fabricación, restauración y ajuste de muebles de madera, puertas y aberturas.',
    icon_url: 'https://cdn.startup.com/icons/carpentry.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f007',
    name: 'Climatización y Refrigeración',
    description: 'Instalación, mantenimiento y recarga de gas de aires acondicionados y estufas.',
    icon_url: 'https://cdn.startup.com/icons/hvac.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f008',
    name: 'Cuidado de Mascotas',
    description: 'Paseo de perros, guardería domiciliaria y peluquería canina.',
    icon_url: 'https://cdn.startup.com/icons/pets.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f009',
    name: 'Soporte Técnico e Informática',
    description: 'Reparación de computadoras, redes WiFi, instalación de software y seguridad.',
    icon_url: 'https://cdn.startup.com/icons/tech-support.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f010',
    name: 'Cerrajería',
    description:
      'Aperturas de urgencia 24hs, cambio de combinaciones, cerraduras digitales y copias.',
    icon_url: 'https://cdn.startup.com/icons/locksmith.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f011',
    name: 'Gasista Matriculado',
    description: 'Instalaciones de gas, habilitaciones, prueba de hermeticidad y artefactos.',
    icon_url: 'https://cdn.startup.com/icons/gas.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f012',
    name: 'Mudanzas y Fletes',
    description: 'Traslado de muebles, embalaje profesional y logística urbana.',
    icon_url: 'https://cdn.startup.com/icons/moving.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f013',
    name: 'Albañilería y Construcción',
    description: 'Reformas, colocación de cerámicos y porcelanatos, revoques y ampliaciones.',
    icon_url: 'https://cdn.startup.com/icons/masonry.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f014',
    name: 'Herrería y Soldadura',
    description: 'Rejas, portones automáticos, barandas, estructuras metálicas y reparaciones.',
    icon_url: 'https://cdn.startup.com/icons/blacksmith.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f015',
    name: 'Techista y Reparación de Techos',
    description: 'Arreglo de filtraciones, canaletas, zinguería, colocación de tejas y membranas.',
    icon_url: 'https://cdn.startup.com/icons/roofing.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f016',
    name: 'Fumigación y Control de Plagas',
    description: 'Desinsectación, desratización y desinfección preventiva con certificación.',
    icon_url: 'https://cdn.startup.com/icons/pest-control.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f017',
    name: 'Seguridad y Cámaras (CCTV)',
    description:
      'Instalación de alarmas domiciliarias, cámaras IP, videoporteros y control de acceso.',
    icon_url: 'https://cdn.startup.com/icons/security-cctv.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f018',
    name: 'Reparación de Electrodomésticos',
    description: 'Service oficial de lavarropas, heladeras, microondas, hornos y lavavajillas.',
    icon_url: 'https://cdn.startup.com/icons/appliances.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f019',
    name: 'Durlock y Yesería',
    description: 'Tabiques divisorios, cielorrasos suspendidos, molduras y aislamiento acústico.',
    icon_url: 'https://cdn.startup.com/icons/drywall.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f020',
    name: 'Tapicería y Restauración',
    description: 'Retapizado de sillones, sillas, banquetas y confección de fundas a medida.',
    icon_url: 'https://cdn.startup.com/icons/upholstery.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f021',
    name: 'Pulido y Plastificado de Pisos',
    description: 'Hidrolaqueado, pulido de parquet, mosaicos graníticos y alisados.',
    icon_url: 'https://cdn.startup.com/icons/flooring.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f022',
    name: 'Impermeabilización',
    description: 'Impermeabilización de terrazas, balcones, frentes y sótanos con garantía.',
    icon_url: 'https://cdn.startup.com/icons/waterproofing.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f023',
    name: 'Cuidado de Adultos Mayores',
    description: 'Acompañamiento diurno y nocturno, asistencia geriátrica y enfermería.',
    icon_url: 'https://cdn.startup.com/icons/elderly-care.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f024',
    name: 'Cuidado Infantil y Niñera',
    description: 'Cuidado responsable de niños, estimulación temprana y apoyo escolar.',
    icon_url: 'https://cdn.startup.com/icons/childcare.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f025',
    name: 'Clases Particulares',
    description: 'Apoyo escolar primario, secundario, idiomas, matemáticas y física.',
    icon_url: 'https://cdn.startup.com/icons/tutoring.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f026',
    name: 'Diseño y Decoración de Interiores',
    description: 'Asesoramiento estético, planos 3D, selección de mobiliario y paletas de color.',
    icon_url: 'https://cdn.startup.com/icons/interior-design.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f027',
    name: 'Organización de Espacios',
    description: 'Optimización y organización de placards, cocinas, vestidores y depósitos.',
    icon_url: 'https://cdn.startup.com/icons/home-organization.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f028',
    name: 'Peluquería y Barbería a Domicilio',
    description: 'Cortes unisex, peinados para eventos, colorimetría y perfilado de barba.',
    icon_url: 'https://cdn.startup.com/icons/hairdressing.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f029',
    name: 'Masajes y Estética',
    description: 'Masajes descontracturantes, relajantes, drenaje linfático y manicuría.',
    icon_url: 'https://cdn.startup.com/icons/massage.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f030',
    name: 'Catering y Chef a Domicilio',
    description:
      'Servicio gastronómico para eventos pequeños, asador a domicilio y menú personalizado.',
    icon_url: 'https://cdn.startup.com/icons/catering.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f031',
    name: 'Mantenimiento de Piletas / Piscinas',
    description: 'Limpieza, balance químico de agua, filtrado y pintura de natatorios.',
    icon_url: 'https://cdn.startup.com/icons/pools.svg',
    active: true,
  },
  {
    id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f032',
    name: 'Vidriería y Cerramientos',
    description:
      'Colocación de vidrios templados, mamparas de baño, espejos y cerramientos de balcón.',
    icon_url: 'https://cdn.startup.com/icons/glazier.svg',
    active: true,
  },
];

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  // Limpia todas las tablas dependientes antes de volver a sembrar las categorías
  await clearDatabase(knex);

  // Inserta las 32 categorías iniciales
  await knex('categories').insert(initialCategories);
}
