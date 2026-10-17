-- Clear all existing trips and trip-related records so the new flow starts clean
DELETE FROM participants;
DELETE FROM meals;
DELETE FROM checklist;
DELETE FROM expenses;
DELETE FROM gear;
DELETE FROM trips;
DELETE FROM sqlite_sequence WHERE name IN ('trips', 'meals', 'checklist', 'expenses', 'gear');
