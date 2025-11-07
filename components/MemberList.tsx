import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, ActivityIndicator } from 'react-native';
import { listMembers } from '../components/lib/members';

export function MemberList({ leagueId }: { leagueId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const rows = await listMembers(leagueId);
        setMembers(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [leagueId]);

  if (loading) return <ActivityIndicator />;

  return (
    <FlatList
      data={members}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: '#eee',
            borderRadius: 12,
          }}
        >
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={{ width: 36, height: 36, borderRadius: 18 }} />
          ) : (
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd' }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>{item.displayName ?? item.userId}</Text>
            <Text style={{ opacity: 0.7, fontSize: 12 }}>{item.role} • {item.status}</Text>
          </View>
        </View>
      )}
    />
  );
}
