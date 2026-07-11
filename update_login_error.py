import re

with open('artifacts/nutrimyway-admin/src/pages/super.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace error handling in SuperLogin
old_catch = """      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
      } finally {"""

new_catch = """      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        if (msg === "Failed to fetch") {
          setError("Server is waking up. Please wait 10 seconds and try again.");
        } else {
          setError(msg);
        }
      } finally {"""

content = content.replace(old_catch, new_catch)

with open('artifacts/nutrimyway-admin/src/pages/super.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('artifacts/nutrimyway-admin/src/pages/login.tsx', 'r', encoding='utf-8') as f:
    login_content = f.read()

old_login_catch = """    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {"""

new_login_catch = """    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (msg === "Failed to fetch") {
        setError("Server is waking up. Please wait 10 seconds and try again.");
      } else {
        setError(msg);
      }
    } finally {"""

login_content = login_content.replace(old_login_catch, new_login_catch)

with open('artifacts/nutrimyway-admin/src/pages/login.tsx', 'w', encoding='utf-8') as f:
    f.write(login_content)
