import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { Plus, Tag, Trash2 } from 'lucide-react-native';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryTypeParam = activeType === 'ALL' ? undefined : activeType;
  const { data, loading, refetch } = useQuery<{ myCategories: Category[] }>(MY_CATEGORIES_QUERY, {
    variables: { type: queryTypeParam }
  });

  const [createCategory, { loading: creating }] = useMutation(CREATE_CATEGORY_MUTATION, {
    onCompleted: () => {
      setName('');
      setErrorMessage(null);
      refetch();
    },
    onError: (err) => setErrorMessage(err.message)
  });

  const [deleteCategory] = useMutation(DELETE_CATEGORY_MUTATION, {
    onCompleted: () => refetch(),
    onError: (err) => setErrorMessage(err.message)
  });

  const handleCreate = async () => {
    if (!name.trim()) {
      setErrorMessage('Informe o nome da categoria.');
      return;
    }
    setErrorMessage(null);
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
  };

  const handleDelete = async (id: string) => {
    await deleteCategory({ variables: { id } });
  };

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

      {/* Form Criar Categoria */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nova Categoria</Text>
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

        <Pressable
          accessibilityRole="button"
          disabled={creating}
          onPress={handleCreate}
          style={styles.createButton}
        >
          {creating ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Plus color="#ffffff" size={18} />
              <Text style={styles.createButtonText}>Adicionar Categoria</Text>
            </>
          )}
        </Pressable>
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
              <View key={cat.id} style={styles.categoryCard}>
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
  cardTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  errorText: { color: '#dc2626', fontSize: 13, backgroundColor: '#fef2f2', padding: 8, borderRadius: 4 },
  formGroup: { gap: 6 },
  label: { color: '#334155', fontSize: 14, fontWeight: '600' },
  input: { borderColor: '#cbd5e1', borderRadius: 6, borderWidth: 1, fontSize: 14, minHeight: 42, paddingHorizontal: 12, color: '#0f172a' },
  typeSelector: { flexDirection: 'row', gap: 8 },
  typeOption: { borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 14, paddingVertical: 8 },
  typeOptionSelected: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  typeOptionText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  typeOptionTextSelected: { color: '#ffffff' },
  colorSelector: { flexDirection: 'row', gap: 10 },
  colorOption: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorOptionSelected: { borderColor: '#0f172a' },
  createButton: { alignItems: 'center', backgroundColor: '#0f766e', borderRadius: 6, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 42, paddingHorizontal: 16 },
  createButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterTab: { borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#e2e8f0' },
  filterTabActive: { backgroundColor: '#0f766e' },
  filterTabText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: '#ffffff' },
  categoryList: { gap: 10 },
  emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic', marginTop: 12 },
  categoryCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 6, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  categoryBadge: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  categoryRight: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  categoryTypeTag: { backgroundColor: '#f1f5f9', color: '#475569', fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  deleteButton: { padding: 6 }
});
