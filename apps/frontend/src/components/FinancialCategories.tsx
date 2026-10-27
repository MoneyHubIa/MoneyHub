import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  Briefcase,
  Car,
  Check,
  GraduationCap,
  HeartPulse,
  Home,
  LucideIcon,
  Pencil,
  Plane,
  Plus,
  ShoppingCart,
  Tag,
  Trash2,
  Utensils,
  X
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Badge } from './ui/Badge';
import { confirmDestructiveAction } from '../utils/confirmAction';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

const MY_CATEGORIES_QUERY = gql`
  query MyCategories($type: CategoryType) {
    myCategories(type: $type) {
      id
      name
      type
      color
      icon
      createdAt
    }
  }
`;

const CREATE_CATEGORY_MUTATION = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      name
      type
      color
      icon
    }
  }
`;

const UPDATE_CATEGORY_MUTATION = gql`
  mutation UpdateCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      id
      name
      type
      color
      icon
    }
  }
`;

const DELETE_CATEGORY_MUTATION = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

type Category = {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'BOTH';
  color: string;
  icon: string;
  createdAt: string;
};

// As 9 cores solicitadas no Design System + a cor clássica compatível
export const CATEGORY_COLORS = [
  '#0f766e',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F43F5E',
  '#F59E0B',
  '#84CC16'
];

export const CATEGORY_ICONS: Array<{ name: string; icon: LucideIcon; label: string }> = [
  { name: 'tag', icon: Tag, label: 'Geral' },
  { name: 'shopping-cart', icon: ShoppingCart, label: 'Compras' },
  { name: 'home', icon: Home, label: 'Moradia' },
  { name: 'utensils', icon: Utensils, label: 'Refeição' },
  { name: 'car', icon: Car, label: 'Transporte' },
  { name: 'briefcase', icon: Briefcase, label: 'Trabalho' },
  { name: 'heart-pulse', icon: HeartPulse, label: 'Saúde' },
  { name: 'graduation-cap', icon: GraduationCap, label: 'Educação' },
  { name: 'plane', icon: Plane, label: 'Viagem' }
];

function getCategoryIcon(iconName: string): LucideIcon {
  const found = CATEGORY_ICONS.find((item) => item.name === iconName);
  return found ? found.icon : Tag;
}

export function FinancialCategories(): React.JSX.Element {
  const { theme } = useTheme();
  const [activeType, setActiveType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [name, setName] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'BOTH'>('BOTH');
  const [selectedColor, setSelectedColor] = useState('#0f766e');
  const [selectedIcon, setSelectedIcon] = useState('tag');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryTypeParam = activeType === 'ALL' ? undefined : activeType;
  const { data, loading, refetch } = useQuery<{ myCategories: Category[] }>(MY_CATEGORIES_QUERY, {
    variables: { type: queryTypeParam }
  });

  const resetForm = () => {
    setName('');
    setType('BOTH');
    setSelectedColor('#0f766e');
    setSelectedIcon('tag');
    setEditingId(null);
    setErrorMessage(null);
    refetch();
  };

  const [createCategory, { loading: creating }] = useMutation(CREATE_CATEGORY_MUTATION, {
    onCompleted: () => resetForm(),
    onError: (err) => setErrorMessage(err.message)
  });

  const [updateCategory, { loading: updating }] = useMutation(UPDATE_CATEGORY_MUTATION, {
    onCompleted: () => resetForm(),
    onError: (err) => setErrorMessage(err.message)
  });

  const [deleteCategory] = useMutation(DELETE_CATEGORY_MUTATION, {
    onCompleted: () => refetch(),
    onError: (err) => setErrorMessage(err.message)
  });

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMessage('Informe o nome da categoria.');
      return;
    }
    setErrorMessage(null);

    if (editingId) {
      await updateCategory({
        variables: {
          input: {
            id: editingId,
            name: name.trim(),
            type,
            color: selectedColor,
            icon: selectedIcon
          }
        }
      });
    } else {
      await createCategory({
        variables: {
          input: {
            name: name.trim(),
            type,
            color: selectedColor,
            icon: selectedIcon
          }
        }
      });
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setType(cat.type);
    setSelectedColor(cat.color || '#0f766e');
    setSelectedIcon(cat.icon || 'tag');
    setErrorMessage(null);
  };

  const cancelEdit = () => {
    resetForm();
  };

  const handleDelete = (id: string, name?: string) => {
    confirmDestructiveAction({
      title: 'Excluir Categoria',
      message: `Tem certeza de que deseja excluir ${name ? `"${name}"` : 'esta categoria'}? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        if (editingId === id) {
          cancelEdit();
        }
        await deleteCategory({ variables: { id } });
      }
    });
  };

  const isSaving = creating || updating;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.income }]}>GESTÃO FINANCEIRA</Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.textPrimary }]}
        >
          Categorias Financeiras
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Organize e classifique suas receitas e despesas com categorias personalizadas, cores e ícones.
        </Text>
      </View>

      {/* Form Criar / Editar Categoria */}
      <Card
        style={[
          styles.formCard,
          editingId ? { borderColor: theme.income } : {}
        ]}
        variant={editingId ? 'elevated' : 'surface'}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            {editingId ? 'Editar Categoria' : 'Nova Categoria'}
          </Text>
          {editingId && (
            <Pressable onPress={cancelEdit} style={styles.cancelLink}>
              <X color={theme.textSecondary} size={16} />
              <Text style={[styles.cancelLinkText, { color: theme.textSecondary }]}>
                Cancelar edição
              </Text>
            </Pressable>
          )}
        </View>

        {errorMessage && (
          <View style={[styles.errorBox, { backgroundColor: theme.expenseBadge }]}>
            <Text style={[styles.errorText, { color: theme.expense }]}>{errorMessage}</Text>
          </View>
        )}

        <Input
          accessibilityLabel="Nome da categoria"
          label="Nome da Categoria"
          onChangeText={setName}
          placeholder="Ex: Alimentação, Salário, Lazer"
          value={name}
        />

        {/* Seletor de Tipo */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Tipo de Categoria</Text>
          <View style={styles.typeSelector}>
            {(['BOTH', 'EXPENSE', 'INCOME'] as const).map((t) => {
              const isSelected = type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.typeOption,
                    {
                      backgroundColor: isSelected ? theme.income : theme.bgElevated,
                      borderColor: isSelected ? theme.income : theme.borderElevated
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      { color: isSelected ? '#FFFFFF' : theme.textSecondary }
                    ]}
                  >
                    {t === 'BOTH' ? 'Ambos' : t === 'EXPENSE' ? 'Despesa' : 'Receita'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Seletor Visual de 9 Cores */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Cor de Destaque</Text>
          <View style={styles.colorSelector}>
            {CATEGORY_COLORS.map((c) => {
              const isSelected = selectedColor.toLowerCase() === c.toLowerCase();
              return (
                <Pressable
                  accessibilityLabel={`Selecionar cor ${c}`}
                  key={c}
                  onPress={() => setSelectedColor(c)}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c },
                    isSelected && [
                      styles.colorOptionSelected,
                      { borderColor: theme.textPrimary }
                    ]
                  ]}
                >
                  {isSelected && <Check color="#FFFFFF" size={14} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Seletor de Ícone */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Ícone Representativo</Text>
          <ScrollView
            contentContainerStyle={styles.iconSelector}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {CATEGORY_ICONS.map((item) => {
              const IconComp = item.icon;
              const isSelected = selectedIcon === item.name;
              return (
                <Pressable
                  accessibilityLabel={`Selecionar ícone ${item.label}`}
                  key={item.name}
                  onPress={() => setSelectedIcon(item.name)}
                  style={[
                    styles.iconOption,
                    {
                      backgroundColor: isSelected
                        ? 'rgba(16, 185, 129, 0.2)'
                        : theme.bgElevated,
                      borderColor: isSelected ? theme.income : theme.borderElevated
                    }
                  ]}
                >
                  <IconComp
                    color={isSelected ? theme.income : theme.textSecondary}
                    size={18}
                  />
                  <Text
                    style={[
                      styles.iconOptionLabel,
                      { color: isSelected ? theme.income : theme.textMuted }
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Form Actions */}
        <View style={styles.formActions}>
          <Button
            icon={editingId ? Check : Plus}
            loading={isSaving}
            onPress={handleSave}
            title={editingId ? 'Salvar Alterações' : 'Adicionar Categoria'}
            variant="primary"
          />

          {editingId && (
            <Button
              onPress={cancelEdit}
              title="Cancelar"
              variant="secondary"
            />
          )}
        </View>
      </Card>

      {/* Filtros da Lista */}
      <View style={styles.filterRow}>
        {(['ALL', 'EXPENSE', 'INCOME'] as const).map((t) => {
          const isActive = activeType === t;
          return (
            <Pressable
              key={t}
              onPress={() => setActiveType(t)}
              style={[
                styles.filterTab,
                {
                  backgroundColor: isActive ? theme.income : theme.bgElevated,
                  borderColor: isActive ? theme.income : theme.borderElevated
                }
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: isActive ? '#FFFFFF' : theme.textSecondary }
                ]}
              >
                {t === 'ALL' ? 'Todas' : t === 'EXPENSE' ? 'Despesas' : 'Receitas'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Lista de Categorias */}
      {loading ? (
        <ActivityIndicator color={theme.income} size="large" style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.categoryGrid}>
          {data?.myCategories.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Nenhuma categoria cadastrada ainda.
              </Text>
            </Card>
          ) : (
            data?.myCategories.map((cat) => {
              const IconComp = getCategoryIcon(cat.icon);
              const isSelectedForEdit = editingId === cat.id;

              return (
                <Card
                  key={cat.id}
                  style={[
                    styles.categoryCard,
                    isSelectedForEdit && { borderColor: theme.income }
                  ]}
                >
                  <View style={styles.categoryHeader}>
                    <View
                      style={[
                        styles.categoryIconWrap,
                        { backgroundColor: cat.color ? `${cat.color}20` : 'rgba(16, 185, 129, 0.15)' }
                      ]}
                    >
                      <IconComp color={cat.color || theme.income} size={20} />
                    </View>

                    <Badge
                      label={
                        cat.type === 'BOTH'
                          ? 'Ambos'
                          : cat.type === 'EXPENSE'
                            ? 'Despesa'
                            : 'Receita'
                      }
                      tone={
                        cat.type === 'INCOME'
                          ? 'income'
                          : cat.type === 'EXPENSE'
                            ? 'expense'
                            : 'neutral'
                      }
                    />
                  </View>

                  <Text
                    numberOfLines={1}
                    style={[styles.categoryName, { color: theme.textPrimary }]}
                  >
                    {cat.name}
                  </Text>

                  <View style={[styles.categoryActions, { borderTopColor: theme.border }]}>
                    <Pressable
                      accessibilityLabel={`Editar categoria ${cat.name}`}
                      accessibilityRole="button"
                      onPress={() => startEdit(cat)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        { backgroundColor: theme.bgElevated, opacity: pressed ? 0.7 : 1 }
                      ]}
                    >
                      <Pencil color={theme.income} size={15} />
                      <Text style={[styles.actionButtonText, { color: theme.income }]}>
                        Editar
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityLabel={`Excluir categoria ${cat.name}`}
                      accessibilityRole="button"
                      hitSlop={4}
                      onPress={() => handleDelete(cat.id, cat.name)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        { backgroundColor: theme.bgElevated, opacity: pressed ? 0.7 : 1 }
                      ]}
                    >
                      <Trash2 color={theme.expense} size={15} />
                      <Text style={[styles.actionButtonText, { color: theme.expense }]}>
                        Excluir
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    minHeight: 40,
    justifyContent: 'center'
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600'
  },
  cancelLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4
  },
  cancelLinkText: {
    fontSize: 13
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700'
  },
  categoryActions: {
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 12
  },
  categoryCard: {
    flexBasis: 220,
    flexGrow: 1,
    gap: 12,
    minHeight: 140
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  categoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  categoryIconWrap: {
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700'
  },
  colorOption: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  colorOptionSelected: {
    elevation: 3,
    transform: [{ scale: 1.1 }]
  },
  colorSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  container: {
    gap: 20,
    width: '100%'
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    width: '100%'
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic'
  },
  errorBox: {
    borderRadius: 6,
    padding: 10
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600'
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8
  },
  filterTab: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600'
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6
  },
  formCard: {
    gap: 14,
    padding: 20
  },
  formGroup: {
    gap: 8
  },
  header: {
    gap: 6
  },
  iconOption: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    minWidth: 70,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  iconOptionLabel: {
    fontSize: 11,
    fontWeight: '600'
  },
  iconSelector: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4
  },
  label: {
    fontSize: 13,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 720
  },
  title: {
    fontSize: 26,
    fontWeight: '700'
  },
  typeOption: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '600'
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8
  }
});
