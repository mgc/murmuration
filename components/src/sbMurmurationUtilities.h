#ifndef __SBMURMURATIONUTILITIES_H__
#define __SBMURMURATIONUTILITIES_H__

#include <sbIMurmurationUtilities.h>

#include <nsStringGlue.h>
#include <nsCOMPtr.h>

class sbMurmurationUtilities : public sbIMurmurationUtilities
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_SBIMURMURATIONUTILITIES

  sbMurmurationUtilities();
  ~sbMurmurationUtilities();
};
#endif /* __SBMURMURATIONUTILITIES_H__ */

