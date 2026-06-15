import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/Home/HomeScreen';
import WorkoutStack from './WorkoutStack';
import StatsScreen from '../screens/Stats/StatsScreen';
import ProfileStack from './ProfileStack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

// Création du Bottom Tab Navigator
const Tab = createBottomTabNavigator();

export default function BottomTabs() {
    return (
        <Tab.Navigator
        screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: { backgroundColor: Colors.backgroundDeep, borderTopWidth: 0 },
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: Colors.textMuted,
            tabBarIcon: ({ color, size }) => {
                let icon = 'home';
                if (route.name === 'Séances') icon = 'barbell';
                if (route.name === 'Stats') icon = 'stats-chart';
                if (route.name === 'ProfileTab') icon = 'person';
                return <Ionicons name={icon} size={22} color={color} />;
            },
        })}
        >
        <Tab.Screen name="Accueil" component={HomeScreen} />
        <Tab.Screen name="Séances" component={WorkoutStack} />
        <Tab.Screen name="Stats" component={StatsScreen} />
        <Tab.Screen 
            name="ProfileTab" 
            component={ProfileStack}
            options={{
                tabBarLabel: 'Profil',
                headerShown: false, // On cache le header du Tab car la Stack en a déjà un
            }}
        />
        </Tab.Navigator>
    );
}