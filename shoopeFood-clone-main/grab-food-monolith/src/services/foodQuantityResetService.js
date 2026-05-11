const { Food } = require("../models");

const getDelayToNextLocalMidnight = () => {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);

  return Math.max(nextMidnight.getTime() - now.getTime(), 1000);
};

const resetExpiredFoodQuantities = async () => {
  const resetDate = await Food.resetExpiredDailyQuantities();
  return resetDate;
};

const scheduleDailyFoodQuantityReset = () => {
  let timer = null;

  const runAndScheduleNext = async () => {
    try {
      const resetDate = await resetExpiredFoodQuantities();
      console.log(`Food quantities reset for ${resetDate}`);
    } catch (error) {
      console.error("Cannot reset food quantities:", error.message);
    } finally {
      timer = setTimeout(runAndScheduleNext, getDelayToNextLocalMidnight());
    }
  };

  timer = setTimeout(runAndScheduleNext, getDelayToNextLocalMidnight());

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
  };
};

module.exports = {
  resetExpiredFoodQuantities,
  scheduleDailyFoodQuantityReset,
};
