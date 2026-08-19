import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { Building2, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

const MY_COST_CENTERS_QUERY = gql`
  query MyCostCenters {
    myCostCenters {
      id
      name
      description
      createdAt
    }
  }
`;

const CREATE_COST_CENTER_MUTATION = gql`
  mutation CreateCostCenter($input: CreateCostCenterInput!) {
    createCostCenter(input: $input) {
      id
      name
      description
    }
  }
`;

const DELETE_COST_CENTER_MUTATION = gql`
  mutation DeleteCostCenter($id: ID!) {
    deleteCostCenter(id: $id)
  }
`;

type CostCenter = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
};

export function CostCenters() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery<{ myCostCenters: CostCenter[] }>(MY_COST_CENTERS_QUERY);

  const [createCostCenter, { loading: creating }] = useMutation(CREATE_COST_CENTER_MUTATION, {
    onCompleted: () => {
      setName('');
      setDescription('');
      setErrorMessage(null);
      refetch();
    },
    onError: (err) => setErrorMessage(err.message)
  });

  const [deleteCostCenter] = useMutation(DELETE_COST_CENTER_MUTATION, {
    onCompleted: () => refetch(),
    onError: (err) => setErrorMessage(err.message)
  });

  const handleCreate = async () => {
    if (!name.trim()) {
      setErrorMessage('Informe o nome do centro de custo.');
      return;
    }
    setErrorMessage(null);
    await createCostCenter({
      variables: {
        input: {
          name: name.trim(),
          description: description.trim() || undefined
        }
      }
    });
  };

  const handleDelete = async (id: string) => {
    await deleteCostCenter({ variables: { id } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Finanças</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Centros de Custo
        </Text>
        <Text style={styles.subtitle}>
          Agrupe lançamentos por projetos, áreas ou departamentos.
        </Text>
      </View>

      {/* Form Criar Centro de Custo */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Novo Centro de Custo</Text>
        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            accessibilityLabel="Nome do centro de custo"
            onChangeText={setName}
            placeholder="Ex: Pessoal, Trabalho, Projeto X"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={name}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Descrição (opcional)</Text>
          <TextInput
            accessibilityLabel="Descrição do centro de custo"
            onChangeText={setDescription}
            placeholder="Breve detalhamento"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={description}
          />
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
              <Text style={styles.createButtonText}>Adicionar Centro de Custo</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Lista */}
      {loading ? (
        <ActivityIndicator color="#0f766e" size="large" style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.list}>
          {data?.myCostCenters.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum centro de custo cadastrado ainda.</Text>
          ) : (
            data?.myCostCenters.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemBadge}>
                  <Building2 color="#0f766e" size={20} />
                  <View>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.itemDesc}>{item.description}</Text>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  accessibilityLabel={`Excluir centro de custo ${item.name}`}
                  onPress={() => handleDelete(item.id)}
                  style={styles.deleteButton}
                >
                  <Trash2 color="#ef4444" size={16} />
                </Pressable>
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
  createButton: { alignItems: 'center', backgroundColor: '#0f766e', borderRadius: 6, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 42, paddingHorizontal: 16 },
  createButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  list: { gap: 10 },
  emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic', marginTop: 12 },
  itemCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 6, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  itemBadge: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  itemName: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  itemDesc: { color: '#64748b', fontSize: 13 },
  deleteButton: { padding: 6 }
});
