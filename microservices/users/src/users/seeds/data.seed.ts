import { DataSource } from 'typeorm';  
import { Gender } from '../entities/gender.entity';
import { Group } from '../entities/group.entity';

export async function seedDefaultData(dataSource: DataSource) {
  const genderRepo = dataSource.getRepository(Gender); 
  const groupRepo = dataSource.getRepository(Group); 
  const genders = ['Masculino', 'Femenino', 'Otro'];
    const groups = [
    'ACCOUNTANTS', 'ADMINS', 'CASHIERS',
    'CSRS', 'GUESTS', 'TECHNICIANS',
    'IFE', 'CSRSPER', 'CSRSSALE','COMPANY_ADMIN'
  ];

  for (const name of genders) {
    const exists = await genderRepo.findOne({ where: { name } });
    if (!exists) {
      await genderRepo.save(genderRepo.create({ name }));
    }
  }

    for (const name of groups) {
    const exists = await groupRepo.findOne({ where: { name } });
    if (!exists) {
      await groupRepo.save(groupRepo.create({ name }));
    }
  }

  console.log('Datos por defecto inicializados');
}
