/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  // Deletes ALL existing entries in categories
  await knex('categories').del();

  // Inserts seed entries
  await knex('categories').insert([
    {
      id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f001',
      name: 'Limpieza',
      description: 'Servicios de limpieza del hogar, oficinas y fin de obra.',
      icon_url: 'https://example.com/icons/cleaning.svg',
      active: true,
    },
    {
      id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f002',
      name: 'Plomería',
      description: 'Instalación y reparación de tuberías, grifería, fugas de agua y gas.',
      icon_url: 'https://example.com/icons/plumbing.svg',
      active: true,
    },
    {
      id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f003',
      name: 'Electricidad',
      description: 'Instalaciones eléctricas, reparaciones de cortocircuitos, llaves térmicas y cableado.',
      icon_url: 'https://example.com/icons/electricity.svg',
      active: true,
    },
    {
      id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f004',
      name: 'Jardinería',
      description: 'Mantenimiento de jardines, poda de árboles, corte de césped y paisajismo.',
      icon_url: 'https://example.com/icons/gardening.svg',
      active: true,
    },
    {
      id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f005',
      name: 'Pintura',
      description: 'Pintura interior y exterior, enduido, barnizado y preparación de superficies.',
      icon_url: 'https://example.com/icons/painting.svg',
      active: true,
    },
    {
      id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f006',
      name: 'Carpintería',
      description: 'Diseño, fabricación y reparación de muebles de madera, puertas y marcos.',
      icon_url: 'https://example.com/icons/carpentry.svg',
      active: true,
    },
    {
      id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f007',
      name: 'Climatización',
      description: 'Instalación, mantenimiento y service de aires acondicionados y sistemas de calefacción.',
      icon_url: 'https://example.com/icons/hvac.svg',
      active: true,
    },
    {
      id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f008',
      name: 'Cuidado de Mascotas',
      description: 'Paseo de perros, guardería temporal y peluquería canina/felina.',
      icon_url: 'https://example.com/icons/pets.svg',
      active: true,
    },
    {
      id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f009',
      name: 'Soporte Técnico',
      description: 'Reparación de computadoras, instalación de software, redes hogareñas y configuración de routers.',
      icon_url: 'https://example.com/icons/tech-support.svg',
      active: true,
    },
  ]);
}
