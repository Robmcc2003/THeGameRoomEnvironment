// Edit League Screen
// I allow league owners to edit league settings and tournament details.
/* Form handling code (lines 63-104, 106-173) uses React Native components - https://reactnative.dev/docs/textinput */
/* KeyboardAvoidingView from React Native - https://reactnative.dev/docs/keyboardavoidingview */
/* League update code uses Firestore updateDoc - https://firebase.google.com/docs/firestore/manage-data/add-data#update-data */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View as RNView,
} from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { Text, View } from '../../components/Themed';
import Logo from '../../components/Logo';
import { useColorScheme } from '../../components/useColorScheme';
import Colors from '../../constants/Colors';

import { auth, db } from '../../FirebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { autoGenerateBracketIfNeeded } from '../../components/lib/tournaments';
import { GameType, getAvailableGameTypes } from '../../components/lib/gameTypes';

export default function EditLeagueScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const router = useRouter();

  // I get theme colours for light and dark mode
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const tint = palette.tint;

  // I set fallback colours if the palette doesn't provide them
  const cardBg = palette.card ?? (scheme === 'dark' ? '#16181A' : '#FFFFFF');
  const borderColor = palette.border ?? (scheme === 'dark' ? '#2A2D2F' : '#E6E6E6');
  const textColor = palette.text ?? '#1F1F1F';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [game, setGame] = useState('');
  const [gameType, setGameType] = useState<GameType | ''>('');
  const [rules, setRules] = useState('');
  const [numberOfRounds, setNumberOfRounds] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [tournamentFormat, setTournamentFormat] = useState<'normal_league' | 'single_elimination' | 'double_elimination' | 'round_robin' | ''>('');
  const [matchDuration, setMatchDuration] = useState('');
  const [prizeInfo, setPrizeInfo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [scoringSystem, setScoringSystem] = useState('');
  const [tieBreakerRules, setTieBreakerRules] = useState('');

  // I load the league data and populate the form fields, checking ownership first
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, 'leagues', String(leagueId));
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          Alert.alert('Not found', 'This league no longer exists.');
          router.back();
          return;
        }
        const data = snap.data() as any;

        // I verify that only the owner can edit the league
        if (auth.currentUser?.uid !== data.ownerId) {
          Alert.alert('No access', 'Only the owner can edit this league.');
          router.back();
          return;
        }

        // I populate all form fields with existing league data
        setName(data.name ?? '');
        setGame(data.game ?? '');
        setGameType(data.gameType ?? '');
        setRules(data.rules ?? '');
        setNumberOfRounds(data.numberOfRounds?.toString() ?? '');
        setMaxParticipants(data.maxParticipants?.toString() ?? '');
        setTournamentFormat(data.tournamentFormat ?? '');
        setMatchDuration(data.matchDuration?.toString() ?? '');
        setPrizeInfo(data.prizeInfo ?? '');
        setStartDate(data.startDate ?? '');
        setEndDate(data.endDate ?? '');
        setRegistrationDeadline(data.registrationDeadline ?? '');
        setDescription(data.description ?? '');
        setScoringSystem(data.scoringSystem ?? '');
        setTieBreakerRules(data.tieBreakerRules ?? '');
      } catch (e) {
        Alert.alert('Error', 'Failed to load league.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [leagueId]);

  // I validate form inputs and save the league updates to Firestore
  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'League name is required.');
      return;
    }

    // I validate numeric fields
    const roundsNum = numberOfRounds.trim() ? parseInt(numberOfRounds.trim(), 10) : null;
    if (numberOfRounds.trim() && (isNaN(roundsNum!) || roundsNum! < 1)) {
      Alert.alert('Validation', 'Number of rounds must be a positive number.');
      return;
    }

    const maxPartsNum = maxParticipants.trim() ? parseInt(maxParticipants.trim(), 10) : null;
    if (maxParticipants.trim() && (isNaN(maxPartsNum!) || maxPartsNum! < 1)) {
      Alert.alert('Validation', 'Max participants must be a positive number.');
      return;
    }

    const matchDurationNum = matchDuration.trim() ? parseInt(matchDuration.trim(), 10) : null;
    if (matchDuration.trim() && (isNaN(matchDurationNum!) || matchDurationNum! < 1)) {
      Alert.alert('Validation', 'Match duration must be a positive number (in minutes).');
      return;
    }

    try {
      setSaving(true);
      const ref = doc(db, 'leagues', String(leagueId));
      // I update the league document with all form values
      await updateDoc(ref, {
        name: name.trim(),
        game: game.trim() || null,
        gameType: gameType || null,
        rules: rules.trim() || null,
        numberOfRounds: roundsNum || null,
        maxParticipants: maxPartsNum || null,
        tournamentFormat: tournamentFormat || null,
        matchDuration: matchDurationNum || null,
        prizeInfo: prizeInfo.trim() || null,
        startDate: startDate.trim() || null,
        endDate: endDate.trim() || null,
        registrationDeadline: registrationDeadline.trim() || null,
        description: description.trim() || null,
        scoringSystem: scoringSystem.trim() || null,
        tieBreakerRules: tieBreakerRules.trim() || null,
        updatedAt: serverTimestamp(),
      });
      
      // I auto-generate brackets if a bracket tournament format is selected
      if (tournamentFormat === 'single_elimination' || tournamentFormat === 'double_elimination') {
        await autoGenerateBracketIfNeeded(String(leagueId));
      }
      
      Alert.alert('Saved', 'League updated.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator color={tint} />
        <Text style={{ marginTop: 8, opacity: 0.7 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <RNView style={{ alignItems: 'center', marginBottom: 8 }}>
            <Logo size="small" showTagline={false} />
          </RNView>
          
          <View
            style={{
              backgroundColor: cardBg,
              borderColor,
              borderWidth: 2,
              borderRadius: 16,
              padding: 18,
              gap: 14,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              League name *
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                height: 50,
                fontSize: 16,
                fontWeight: '500',
              }}
              value={name}
              onChangeText={setName}
              placeholder="Enter league name"
              placeholderTextColor="#9AA0A6"
            />

            <Text style={{ marginTop: 8, fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Game Name
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                height: 50,
                fontSize: 16,
                fontWeight: '500',
              }}
              value={game}
              onChangeText={setGame}
              placeholder="FIFA, NBA 2K, Madden…"
              placeholderTextColor="#9AA0A6"
            />
            <Text style={{ marginTop: 16, fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Game Type
            </Text>
            <RNView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {getAvailableGameTypes().map((config) => (
                <TouchableOpacity
                  key={config.id}
                  onPress={() => setGameType(gameType === config.id ? '' : config.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: gameType === config.id ? tint : borderColor,
                    backgroundColor: gameType === config.id ? tint : 'transparent',
                    shadowColor: gameType === config.id ? tint : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: gameType === config.id ? 0.3 : 0,
                    shadowRadius: 4,
                    elevation: gameType === config.id ? 3 : 0,
                  }}
                >
                  <Text style={{
                    fontWeight: '600',
                    color: gameType === config.id ? '#FFFFFF' : textColor,
                  }}>
                    {config.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </RNView>
            {gameType && (
              <Text style={{ fontSize: 12, opacity: 0.7, marginTop: 8, color: textColor }}>
                {getAvailableGameTypes().find(g => g.id === gameType)?.description}
              </Text>
            )}

            <Text style={{ marginTop: 8, fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Rules & Guidelines
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                minHeight: 120,
                textAlignVertical: 'top',
                fontSize: 16,
                fontWeight: '500',
              }}
              value={rules}
              onChangeText={setRules}
              placeholder="Enter tournament rules, guidelines, and any special instructions for participants..."
              placeholderTextColor="#9AA0A6"
              multiline
              numberOfLines={6}
            />

            <Text style={{ marginTop: 8, fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Number of Rounds
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                height: 50,
                fontSize: 16,
                fontWeight: '500',
              }}
              value={numberOfRounds}
              onChangeText={setNumberOfRounds}
              placeholder="e.g. 5, 10, 20"
              placeholderTextColor="#9AA0A6"
              keyboardType="numeric"
            />

            <Text style={{ marginTop: 8, fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Max Participants
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                height: 50,
                fontSize: 16,
                fontWeight: '500',
              }}
              value={maxParticipants}
              onChangeText={setMaxParticipants}
              placeholder="e.g. 8, 16, 32"
              placeholderTextColor="#9AA0A6"
              keyboardType="numeric"
            />
          </View>

          {/* Tournament Format Section */}
          <View
            style={{
              backgroundColor: cardBg,
              borderColor,
              borderWidth: 2,
              borderRadius: 16,
              padding: 18,
              gap: 14,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 20, color: textColor, letterSpacing: 0.3 }}>
              Tournament Format
            </Text>
            <RNView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['normal_league', 'single_elimination', 'double_elimination', 'round_robin'] as const).map((format) => (
                <TouchableOpacity
                  key={format}
                  onPress={() => setTournamentFormat(tournamentFormat === format ? '' : format)}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: tournamentFormat === format ? tint : borderColor,
                    backgroundColor: tournamentFormat === format ? tint : 'transparent',
                    shadowColor: tournamentFormat === format ? tint : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: tournamentFormat === format ? 0.3 : 0,
                    shadowRadius: 4,
                    elevation: tournamentFormat === format ? 3 : 0,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: '600',
                      color: tournamentFormat === format ? '#fff' : textColor,
                      textTransform: 'capitalize',
                    }}
                  >
                    {format.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </RNView>
          </View>

          {/* Match Settings Section */}
          <View
            style={{
              backgroundColor: cardBg,
              borderColor,
              borderWidth: 2,
              borderRadius: 16,
              padding: 18,
              gap: 14,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 20, color: textColor, letterSpacing: 0.3 }}>
              Match Settings
            </Text>
            <Text style={{ fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Match Duration (minutes)
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                height: 50,
                fontSize: 16,
                fontWeight: '500',
              }}
              value={matchDuration}
              onChangeText={setMatchDuration}
              placeholder="e.g. 15, 30, 60"
              placeholderTextColor="#9AA0A6"
              keyboardType="numeric"
            />
            <Text style={{ marginTop: 8, fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Scoring System
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                minHeight: 90,
                textAlignVertical: 'top',
                fontSize: 16,
                fontWeight: '500',
              }}
              value={scoringSystem}
              onChangeText={setScoringSystem}
              placeholder="Describe how matches are scored (e.g., Best of 3, First to 10 points, etc.)"
              placeholderTextColor="#9AA0A6"
              multiline
              numberOfLines={4}
            />
            <Text style={{ marginTop: 8, fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Tie-Breaker Rules
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                minHeight: 90,
                textAlignVertical: 'top',
                fontSize: 16,
                fontWeight: '500',
              }}
              value={tieBreakerRules}
              onChangeText={setTieBreakerRules}
              placeholder="Describe tie-breaker rules if applicable"
              placeholderTextColor="#9AA0A6"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Tournament Dates Section */}
          <View
            style={{
              backgroundColor: cardBg,
              borderColor,
              borderWidth: 2,
              borderRadius: 16,
              padding: 18,
              gap: 14,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 20, color: textColor, letterSpacing: 0.3 }}>
              Tournament Dates
            </Text>
            <Text style={{ fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Registration Deadline
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                height: 50,
                fontSize: 16,
                fontWeight: '500',
              }}
              value={registrationDeadline}
              onChangeText={setRegistrationDeadline}
              placeholder="YYYY-MM-DD or MM/DD/YYYY"
              placeholderTextColor="#9AA0A6"
            />
            <Text style={{ marginTop: 8, fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Start Date
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                height: 50,
                fontSize: 16,
                fontWeight: '500',
              }}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD or MM/DD/YYYY"
              placeholderTextColor="#9AA0A6"
            />
            <Text style={{ marginTop: 8, fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              End Date
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                height: 50,
                fontSize: 16,
                fontWeight: '500',
              }}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD or MM/DD/YYYY"
              placeholderTextColor="#9AA0A6"
            />
          </View>

          {/* Additional Information Section */}
          <View
            style={{
              backgroundColor: cardBg,
              borderColor,
              borderWidth: 2,
              borderRadius: 16,
              padding: 18,
              gap: 14,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 20, color: textColor, letterSpacing: 0.3 }}>
              Additional Information
            </Text>
            <Text style={{ fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Tournament Description
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                minHeight: 110,
                textAlignVertical: 'top',
                fontSize: 16,
                fontWeight: '500',
              }}
              value={description}
              onChangeText={setDescription}
              placeholder="Provide a detailed description of the tournament..."
              placeholderTextColor="#9AA0A6"
              multiline
              numberOfLines={5}
            />
            <Text style={{ marginTop: 8, fontWeight: '800', fontSize: 18, color: textColor, letterSpacing: 0.3 }}>
              Prize Information
            </Text>
            <TextInput
              style={{
                borderWidth: 2,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                minHeight: 110,
                textAlignVertical: 'top',
                fontSize: 16,
                fontWeight: '500',
              }}
              value={prizeInfo}
              onChangeText={setPrizeInfo}
              placeholder="Describe prizes, rewards, or incentives for winners..."
              placeholderTextColor="#9AA0A6"
              multiline
              numberOfLines={5}
            />
          </View>

          <TouchableOpacity
            onPress={onSave}
            disabled={saving}
            style={{
              backgroundColor: tint,
              height: 56,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.7 : 1,
              borderWidth: 2,
              borderColor: '#000000',
              shadowColor: tint,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18, letterSpacing: 0.5 }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
