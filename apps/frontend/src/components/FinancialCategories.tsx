import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { Check, Pencil, Plus, Tag, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

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

const COLOR_OPTIONS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#059669', '#475569'];

export function FinancialCategories() {
  const [activeType, setActiveType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [name, setName] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'BOTH'>('BOTH');
  const [selectedColor, setSelectedColor] = useState('#0f766e');
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
            icon: 'tag'
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
            icon: 'tag'
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
    setErrorMessage(null);
  };

  const cancelEdit = () => {
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (editingId === id) {
      cancelEdit();
    }
    await deleteCategory({ variables: { id } });
  };

  const isSaving = creating || updating;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Finanças</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Categorias Financeiras
        </Text>
        <Text style={styles.subtitle}>
          Organize suas receitas e despesas com categorias personalizadas.
        </Text>
      </View>

      {/* Form Criar/Editar Categoria */}
      <View style={[styles.card, editingId && styles.cardEditing]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            {editingId ? 'Editar Categoria' : 'Nova Categoria'}
          </Text>
          {editingId ? (
            <Pressable onPress={cancelEdit} style={styles.cancelLink}>
              <X color="#64748b" size={16} />
              <Text style={styles.cancelLinkText}>Cancelar edição</Text>
            </Pressable>
          ) : null}
        </View>

        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nome da Categoria</Text>
          <TextInput
            accessibilityLabel="Nome da categoria"
            onChangeText={setName}
            placeholder="Ex: Alimentação, Salário, Lazer"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={name}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Tipo</Text>
          <View style={styles.typeSelector}>
            {(['BOTH', 'EXPENSE', 'INCOME'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[styles.typeOption, type === t && styles.typeOptionSelected]}
              >
                <Text style={[styles.typeOptionText, type === t && styles.typeOptionTextSelected]}>
                  {t === 'BOTH' ? 'Ambos' : t === 'EXPENSE' ? 'Despesa' : 'Receita'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Cor</Text>
          <View style={styles.colorSelector}>
            {COLOR_OPTIONS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setSelectedColor(c)}
                style={[
                  styles.colorOption,
                  { backgroundColor: c },
                  selectedColor === c && styles.colorOptionSelected
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.formActions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleSave}
            style={[styles.saveButton, editingId && styles.saveButtonEdit]}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                {editingId ? <Check color="#ffffff" size={18} /> : <Plus color="#ffffff" size={18} />}
                <Text style={styles.saveButtonText}>
                  {editingId ? 'Salvar Alterações' : 'Adicionar Categoria'}
                </Text>
              </>
            )}
          </Pressable>

          {editingId ? (
            <Pressable
              accessibilityRole="button"
              onPress={cancelEdit}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Lista de Categorias */}
      <View style={styles.filterRow}>
        {(['ALL', 'EXPENSE', 'INCOME'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setActiveType(t)}
            style={[styles.filterTab, activeType === t && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, activeType === t && styles.filterTabTextActive]}>
              {t === 'ALL' ? 'Todas' : t === 'EXPENSE' ? 'Despesas' : 'Receitas'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#0f766e" size="large" style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.categoryList}>
          {data?.myCategories.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma categoria cadastrada ainda.</Text>
          ) : (
            data?.myCategories.map((cat) => (
              <View
                key={cat.id}
                style={[styles.categoryCard, editingId === cat.id && styles.categoryCardEditing]}
              >
                <View style={styles.categoryBadge}>
                  <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                  <Tag color={cat.color} size={18} />
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={styles.categoryTypeTag}>
                    {cat.type === 'BOTH' ? 'Ambos' : cat.type === 'EXPENSE' ? 'Despesa' : 'Receita'}
                  </Text>

                  <Pressable
                    accessibilityLabel={`Editar categoria ${cat.name}`}
                    onPress={() => startEdit(cat)}
                    style={styles.editButton}
                  >
                    <Pencil color="#0f766e" size={16} />
                  </Pressable>

                  <Pressable
                    accessibilityLabel={`Excluir categoria ${cat.name}`}
                    onPress={() => handleDelete(cat.id)}
                    style={styles.deleteButton}
                  >
                    <Trash2 color="#ef4444" size={16} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  header: { gap: 8 },
  eyebrow: { color: '#0f766e', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: '#0f172a', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8, borderWidth: 1, gap: 14, padding: 20 },
  cardEditing: { borderColor: '#0f766e', backgroundColor: '#f0fdfa' },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  cancelLink: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  cancelLinkText: { color: '#64748b', fontSize: 13 },
  errorText: { color: '#dc2626', fontSize: 13, backgroundColor: '#fef2f2', padding: 8, borderRadius: 4 },
  formGroup: { gap: 6 },
  label: { color: '#334155', fontSize: 14, fontWeight: '600' },
  input: { borderColor: '#cbd5e1', borderRadius: 6, borderWidth: 1, fontSize: 14, minHeight: 42, paddingHorizontal: 12, color: '#0f172a', backgroundColor: '#ffffff' },
  typeSelector: { flexDirection: 'row', gap: 8 },
  typeOption: { borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#ffffff' },
  typeOptionSelected: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  typeOptionText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  typeOptionTextSelected: { color: '#ffffff' },
  colorSelector: { flexDirection: 'row', gap: 10 },
  colorOption: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorOptionSelected: { borderColor: '#0f172a' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  saveButton: { flex: 1, alignItems: 'center', backgroundColor: '#0f766e', borderRadius: 6, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 42, paddingHorizontal: 16 },
  saveButtonEdit: { backgroundColor: '#0d9488' },
  saveButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  cancelButton: { alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 6, justifyContent: 'center', minHeight: 42, paddingHorizontal: 16 },
  cancelButtonText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterTab: { borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#e2e8f0' },
  filterTabActive: { backgroundColor: '#0f766e' },
  filterTabText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: '#ffffff' },
  categoryList: { gap: 10 },
  emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic', marginTop: 12 },
  categoryCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 6, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  categoryCardEditing: { borderColor: '#0f766e', backgroundColor: '#f0fdfa' },
  categoryBadge: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  categoryRight: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  categoryTypeTag: { backgroundColor: '#f1f5f9', color: '#475569', fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  editButton: { padding: 6 },
  deleteButton: { padding: 6 }
});
