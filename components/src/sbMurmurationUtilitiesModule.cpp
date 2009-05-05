#include "nsIGenericFactory.h"
#include "sbMurmurationUtilities.h"
#include "sbMurmurationUtilitiesCID.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(sbMurmurationUtilities)

static const nsModuleComponentInfo components[] =
{
  {
    "Murmuration Utilities",
    SB_MURMURATIONUTILITIES_CID,
    SB_MURMURATIONUTILITIES_CONTRACTID,
    sbMurmurationUtilitiesConstructor
  }
};

NS_IMPL_NSGETMODULE(SongbirdMurmurationUtilitiesModule, components)

