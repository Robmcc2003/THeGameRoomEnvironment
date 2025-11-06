import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // Ensures content sits safely within screen bounds
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Main container inside ScrollView
  container: {
    flexGrow: 1,                     // ✅ allows ScrollView content to grow
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 60,               // ✅ ensures bottom padding for button
    backgroundColor: '#FFFFFF',
  },

  // Page title at top
  mainTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 22,
    color: '#333333',
  },

  // Input containers for spacing between text boxes
  inputContainer: {
    width: '100%',
    marginBottom: 14,
  },

  // Text inputs (league name / game)
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    paddingHorizontal: 14,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },

  // "Create League" button
  button: {
    backgroundColor: '#5C6BC0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#5C6BC0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4, // for Android shadow
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },

  // "My Leagues" section heading
  sectionTitle: {
    width: '100%',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 26,
    marginBottom: 8,
    color: '#333333',
  },

  // Text shown when no leagues exist
  emptyText: {
    width: '100%',
    marginTop: 6,
    textAlign: 'center',
    fontSize: 16,
    color: '#888888',
  },

  // Each league item in the list
  leagueItem: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },

  leagueName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222222',
  },

  leagueGame: {
    marginTop: 4,
    fontSize: 15,
    color: '#555555',
  },
});
