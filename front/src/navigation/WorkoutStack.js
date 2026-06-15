import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { WorkoutInProgressProvider } from '../context/WorkoutInProgressContext';

import WorkoutListScreen from '../screens/Workouts/WorkoutListScreen';
import WorkoutScreen from '../screens/Workouts/WorkoutScreen';
import ExerciseDetailScreen from '../screens/Workouts/ExerciseDetailScreen';
import WorkoutBuilderScreen from '../screens/Workouts/WorkoutBuilderScreen';
import ManualWorkoutCreatorScreen from '../screens/Workouts/ManualWorkoutCreatorScreen';
import CustomExercisesScreen from '../screens/Workouts/CustomExercisesScreen';
import EditExerciseScreen from '../screens/Workouts/EditExerciseScreen';
import ExerciseStatsScreen from '../screens/Workouts/ExerciseStatsScreen';

const Stack = createNativeStackNavigator();

function StackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkoutList" component={WorkoutListScreen} />
      <Stack.Screen name="WorkoutBuilder" component={WorkoutBuilderScreen} />
      <Stack.Screen name="ManualWorkoutCreator" component={ManualWorkoutCreatorScreen} />
      <Stack.Screen name="CustomExercises" component={CustomExercisesScreen} />
      <Stack.Screen name="EditExercise" component={EditExerciseScreen} />
      <Stack.Screen name="Workout" component={WorkoutScreen} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
      <Stack.Screen name="ExerciseStats" component={ExerciseStatsScreen} />
    </Stack.Navigator>
  );
}

export default function WorkoutStack() {
  return (
    <WorkoutInProgressProvider>
      <StackNavigator />
    </WorkoutInProgressProvider>
  );
}
