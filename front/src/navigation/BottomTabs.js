import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/Home/HomeScreen';
import WorkoutStack from './WorkoutStack';
import StatsScreen from '../screens/Stats/StatsScreen';
import SocialStack from './SocialStack';
import ProfileStack from './ProfileStack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Création du Bottom Tab Navigator
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
    Accueil:    ['home', 'home-outline'],
    'Séances':  ['barbell', 'barbell-outline'],
    Stats:      ['stats-chart', 'stats-chart-outline'],
    SocialTab:  ['people', 'people-outline'],
    ProfileTab: ['person', 'person-outline'],
};

export default function BottomTabs() {
    const insets = useSafeAreaInsets();
    return (
        <Tab.Navigator
        screenOptions={({ route }) => ({
            headerShown: false,
            // Pas d'animation entre onglets : ce sont des pairs (pas une hiérarchie)
            // et ils sont changés des dizaines de fois par session.
            animation: 'none',
            tabBarHideOnKeyboard: true,
            // 56 px de zone tactile + la barre d'accueil iOS (inset) en dessous
            tabBarStyle: {
                backgroundColor: Colors.backgroundDeep,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: Colors.borderSubtle,
                height: 56 + insets.bottom,
            },
            tabBarItemStyle: { paddingTop: 4 },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: Colors.textSecondary,
            tabBarIcon: ({ color, focused }) => {
                const [active, inactive] = TAB_ICONS[route.name] || ['ellipse', 'ellipse-outline'];
                return <Ionicons name={focused ? active : inactive} size={22} color={color} />;
            },
        })}
        >
        <Tab.Screen name="Accueil" component={HomeScreen} />
        <Tab.Screen name="Séances" component={WorkoutStack} />
        <Tab.Screen name="Stats" component={StatsScreen} />
        <Tab.Screen
            name="SocialTab"
            component={SocialStack}
            options={{ tabBarLabel: 'Social', tabBarAccessibilityLabel: 'Social' }}
        />
        <Tab.Screen
            name="ProfileTab"
            component={ProfileStack}
            options={{ tabBarLabel: 'Profil', tabBarAccessibilityLabel: 'Profil' }}
        />
        </Tab.Navigator>
    );
}
