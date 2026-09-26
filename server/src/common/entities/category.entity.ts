import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('fml_categories')
export class Category extends BaseEntity {
  @Column()
  familyId: string;

  @Column()
  name: string;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ nullable: true })
  parentId: string | null;

  @ManyToOne(() => Category, (category) => category.children, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];
}
