# ROI Transitions and Edge Case Analysis

**Date**: September 25, 2025
**Context**: Computer Vision Putting Detection System
**Status**: Investigation Required

## Current ROI System Overview

The Proof of Putt computer vision system uses Region of Interest (ROI) detection to track ball movement and determine make/miss outcomes:

### ROI Transition Flow
1. **PUTTING_MAT_ROI** → Ball starts on putting mat
2. **RAMP_ROI** → Ball travels up the ramp toward hole
3. **CATCH_ROI** → Ball enters catch area (typically indicates miss)
4. **HOLE** → Ball disappears into hole (make)

## Current Logic
- **Make**: Ball disappears from view (enters hole) without hitting catch ROI
- **Miss**: Ball enters catch ROI at any point

## Identified Edge Cases

### Case 1: Lip-Out Scenario (Recently Observed)
**Description**: Ball travels from mat → ramp → lips out of hole → rolls back down ramp → enters catch ROI
**Current Behavior**: Classified as miss (correct)
**Issue**: Ball never actually "made it" but came very close

### Case 2: Catch-to-Hole Transition
**Description**: Ball hits back of catch area → rapidly rolls down tunnel → through hole
**Current Behavior**: Classified as miss (ball entered catch first)
**Concern**: May actually be a legitimate make if ball ultimately goes in hole

### Case 3: Direct Hole Entry
**Description**: Ball goes mat → ramp → hole without disappearing or catch interaction
**Current Behavior**: Classified as make (correct)
**Status**: This is the ideal/expected scenario

## Technical Considerations

### Simplified Approach (Current Recommendation)
**Rule**: Any ball that enters CATCH_ROI = automatic miss, regardless of subsequent hole entry

**Rationale**:
1. **Simplicity**: Clear, unambiguous detection logic
2. **Performance Consistency**: Avoids complex edge case handling
3. **Skill Differentiation**: Rewards putts that go directly to hole vs. "lucky bounces"
4. **Technical Reliability**: Reduces false positive makes from catch-to-hole scenarios

### Complex Approach (Future Investigation)
**Rule**: Track complete ball journey and final destination

**Requirements**:
- Enhanced ball tracking through catch area
- Hole entry detection after catch contact
- Temporal sequence analysis
- Confidence scoring for edge cases

## Recommendations

### Immediate (Current Session)
- **Maintain current logic**: CATCH_ROI entry = miss
- **Document edge cases** for future analysis
- **Monitor false positive/negative rates**

### Future Investigation Items
1. **Catch Area Geometry Analysis**: Study physical setup to understand catch-to-hole mechanics
2. **Ball Tracking Enhancement**: Improve detection of ball state after catch contact
3. **Machine Learning Approach**: Train model on edge case scenarios
4. **User Feedback Integration**: Allow players to dispute obvious misclassifications
5. **Statistics Collection**: Gather data on edge case frequency

## Impact Assessment

**Current System Accuracy**: High for standard putts
**Edge Case Frequency**: Low (rare occurrences)
**User Experience Impact**: Minimal - most players expect lip-outs to be misses
**Development Priority**: Low - focus on core reliability over edge cases

## Conclusion

The current "catch ROI = miss" logic is appropriate for production use. Edge cases like lip-outs and catch-to-hole transitions represent a small percentage of putts and maintaining simple, consistent logic is preferable to complex detection that may introduce more errors than it solves.

Future enhancements should focus on data collection and analysis of these edge cases before implementing more sophisticated detection algorithms.

---

**Next Steps**: Monitor edge case frequency and collect video samples for future analysis.